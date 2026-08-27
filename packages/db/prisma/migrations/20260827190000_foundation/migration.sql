-- ============================================================================
-- SIGAP -- Phase 1 foundation migration
--
-- Hand-written (not `prisma migrate dev` output). This is the FIRST migration
-- against an empty database, so there is no prior application version to stay
-- compatible with and no CREATE INDEX CONCURRENTLY concern: every table
-- created below is empty for the entire duration of this transaction.
-- CONCURRENTLY becomes mandatory starting with the next migration that adds
-- an index to audit_log (or, later, snapshot_line / document_chunk) once
-- those tables hold production data.
--
-- Source of truth: docs/04-TRD.md Sec 3 (ERD + Sec 3.5 design notes),
-- docs/03-FRD.md FR-X-002/005/007/008/010/011/013, docs/07-API-CONTRACT.md.
-- Deliberate deviations from the ERD are called out inline and summarized in
-- packages/db/README.md.
--
-- Single legal entity (docs/04-TRD.md Sec 10 row 6 / docs/01-BRD.md ASM-01):
-- no entity_id / legal_entity_id column exists anywhere below, by design.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions (docs/04-TRD.md Sec 1.2, line 96 / task rule 7)
--
-- Installed now even though pgvector, pg_trgm and btree_gin have no consumer
-- table in THIS migration -- their consumers (document_chunk, evidence
-- title/keyword search) belong to Modul A/C, which are out of scope here.
-- `unaccent` is intentionally NOT installed in this migration: TRD line 96
-- lists only these four; unaccent belongs with the Indonesian text search
-- configuration built alongside document_chunk (docs/04-TRD.md Sec 4,
-- ADR-02), which will be its own migration.
--
-- CREATE EXTENSION requires a database role with sufficient privilege
-- (typically superuser, or a managed-Postgres equivalent such as
-- rds_superuser). If this step fails, ask the DBA to run it manually as
-- superuser, then re-run this migration -- do not comment it out.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ----------------------------------------------------------------------------
-- 2. Application database role (ADR-04 / K-7 prerequisite)
--
-- Password is intentionally NOT set here and must never be committed to a
-- migration file. Provisioning is a DBA task: set it out-of-band via the
-- secrets manager (e.g. `ALTER ROLE sigap_app WITH PASSWORD '...'` run
-- directly by the DBA, outside version control).
--
-- If the role executing this migration lacks CREATEROLE, the statement below
-- fails loudly. Do NOT wrap it in an exception handler to make the migration
-- "succeed" anyway -- that would silently skip a K-7 prerequisite. Instead,
-- have a superuser create the role manually, then re-run this migration.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigap_app') THEN
    CREATE ROLE sigap_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

COMMENT ON ROLE sigap_app IS
  'Runtime role used by the SIGAP API and worker processes (NestJS). Password provisioned out-of-band by the DBA via the secrets manager. Must never be granted UPDATE/DELETE on audit_log (ADR-04, critical control K-7).';

GRANT USAGE ON SCHEMA public TO sigap_app;

-- ----------------------------------------------------------------------------
-- 2b. Ownership role for audit_log (ADR-04 / K-7)
--
-- WHY THIS ROLE EXISTS -- read before changing anything here.
--
-- PostgreSQL treats an object's OWNER as holding every grant option on it,
-- permanently and irrevocably. If sigap_app owns audit_log, then the REVOKE in
-- Sec 9.2 below buys nothing at all: the owner simply grants the privilege back
-- to itself, drops the triggers, and deletes the rows. Three statements, no
-- elevated privileges required. This was demonstrated, not theorised.
--
-- So audit_log is owned by a role that cannot log in and that sigap_app cannot
-- become. NOLOGIN is what makes the ownership unreachable: there is no session
-- that can act as sigap_owner, and sigap_app is never granted membership in it.
--
-- Do NOT grant sigap_app membership in sigap_owner "to simplify deployment".
-- That single GRANT undoes this entire section, and it undoes it silently --
-- every test still passes, because nothing tests for it until someone tries.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sigap_owner') THEN
    CREATE ROLE sigap_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

COMMENT ON ROLE sigap_owner IS
  'Owns audit_log and the audit chain functions (ADR-04, K-7). NOLOGIN by design: ownership carries every grant option, so it must belong to a role no session can assume. Never grant sigap_app membership in this role.';

-- ----------------------------------------------------------------------------
-- 3. Enum types
-- ----------------------------------------------------------------------------
CREATE TYPE app_user_type AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE file_scan_status AS ENUM ('MENUNGGU_PEMINDAIAN', 'BERSIH', 'TERINFEKSI', 'GAGAL_PINDAI');
CREATE TYPE notification_frequency AS ENUM ('SEKETIKA', 'RINGKASAN_HARIAN', 'RINGKASAN_MINGGUAN');

-- ============================================================================
-- 4. Shared foundation tables (docs/04-TRD.md Sec 3.1)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- organization_unit
-- ----------------------------------------------------------------------------
CREATE TABLE organization_unit (
  id         uuid PRIMARY KEY,
  code       varchar(50) NOT NULL,
  name       varchar(200) NOT NULL,
  parent_id  uuid REFERENCES organization_unit (id),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE organization_unit IS
  'Company organizational unit hierarchy (TRD Sec 3.1). Never hard-deleted; deactivate via is_active.';

CREATE UNIQUE INDEX uq_organization_unit_code ON organization_unit (code);
CREATE INDEX idx_organization_unit_parent_id ON organization_unit (parent_id);

-- ----------------------------------------------------------------------------
-- employee
-- ----------------------------------------------------------------------------
CREATE TABLE employee (
  id                uuid PRIMARY KEY,
  employee_number   varchar(50) NOT NULL,
  full_name         varchar(200) NOT NULL,
  email             varchar(320) NOT NULL,
  job_title         varchar(200) NOT NULL,
  org_unit_id       uuid NOT NULL REFERENCES organization_unit (id),
  manager_id        uuid REFERENCES employee (id),
  employment_status varchar(30) NOT NULL,
  joined_at         date NOT NULL,
  terminated_at     date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE employee IS
  'HR master data (FR-X-017), sourced from the HR system integration or periodic file upload until that integration exists. Never hard-deleted; termination is recorded via employment_status/terminated_at.';
COMMENT ON COLUMN employee.manager_id IS
  'Nullable: employees without a direct manager are flagged as a data anomaly at the application layer (FR-X-017 validation rule) and reported to HR, not rejected here.';
COMMENT ON COLUMN employee.email IS
  'Deliberately not UNIQUE: the TRD ERD (Sec 3.1) marks UK only on employee_number, not email. See packages/db/README.md for the tradeoff.';

CREATE UNIQUE INDEX uq_employee_employee_number ON employee (employee_number);
CREATE INDEX idx_employee_org_unit_id ON employee (org_unit_id);
CREATE INDEX idx_employee_manager_id ON employee (manager_id);
CREATE INDEX idx_employee_email ON employee (email);

-- ----------------------------------------------------------------------------
-- app_user
-- ----------------------------------------------------------------------------
CREATE TABLE app_user (
  id            uuid PRIMARY KEY,
  employee_id   uuid REFERENCES employee (id),
  external_id   varchar(200) NOT NULL,
  user_type     app_user_type NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_app_user_type_consistency CHECK (
    (user_type = 'INTERNAL' AND employee_id IS NOT NULL)
    OR
    (user_type = 'EXTERNAL' AND employee_id IS NULL AND expires_at IS NOT NULL)
  )
);

COMMENT ON TABLE app_user IS
  'SIGAP login account. INTERNAL accounts are AD-backed, provisioned just-in-time on first successful login, and linked 1:1 to an employee (FR-X-001). EXTERNAL accounts (AUDITOR_EXT) are invitation-based, never linked to an employee, and always carry a mandatory expiry (FR-X-004 rule 2, enforced by chk_app_user_type_consistency -- application still owns the <= 180 day ceiling).';

CREATE UNIQUE INDEX uq_app_user_employee_id ON app_user (employee_id);
CREATE UNIQUE INDEX uq_app_user_external_id ON app_user (external_id);
CREATE INDEX idx_app_user_is_active ON app_user (is_active);

-- ----------------------------------------------------------------------------
-- role
-- ----------------------------------------------------------------------------
CREATE TABLE role (
  id         uuid PRIMARY KEY,
  code       varchar(50) NOT NULL,
  name       varchar(200) NOT NULL,
  scope_type jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE role IS
  'Role catalog (FR-X-005). scope_type describes which scope dimensions this role can be constrained by (org unit, application, engagement, ...); the concrete scope values for a given grant live on user_role.scope.';

CREATE UNIQUE INDEX uq_role_code ON role (code);

-- ----------------------------------------------------------------------------
-- user_role
-- ----------------------------------------------------------------------------
CREATE TABLE user_role (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES app_user (id),
  role_id     uuid NOT NULL REFERENCES role (id),
  scope       jsonb,
  valid_from  date NOT NULL,
  valid_until date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_role_valid_period CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

COMMENT ON TABLE user_role IS
  'Role grants held by a user (FR-X-005 rules 1 and 4). A user may hold several simultaneous grants; effective permissions are the union of all currently-valid ones. Forbidden role-combination checks (FR-X-006) are enforced in the application repository layer, since they require reading the user''s full grant set plus the SoD rule table, not a per-row constraint.';

CREATE INDEX idx_user_role_user_id ON user_role (user_id);
CREATE INDEX idx_user_role_role_id ON user_role (role_id);
CREATE INDEX idx_user_role_active_period ON user_role (user_id, valid_from, valid_until);

-- ============================================================================
-- 5. Authorization support tables (not in the ERD; see FR-X-005/007 and
--    packages/db/README.md for the design rationale)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- permission
-- ----------------------------------------------------------------------------
CREATE TABLE permission (
  id          uuid PRIMARY KEY,
  code        varchar(100) NOT NULL,
  name        varchar(200) NOT NULL,
  description text,
  module      varchar(10),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE permission IS
  'Permission catalog (FR-X-005), resource:action codes such as evidence:review, document:approve (see 07-API-CONTRACT.md Sec 2.4 sample payload).';

CREATE UNIQUE INDEX uq_permission_code ON permission (code);

-- ----------------------------------------------------------------------------
-- role_permission
-- ----------------------------------------------------------------------------
CREATE TABLE role_permission (
  id            uuid PRIMARY KEY,
  role_id       uuid NOT NULL REFERENCES role (id),
  permission_id uuid NOT NULL REFERENCES permission (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE role_permission IS 'Join table granting permissions to roles (FR-X-005).';

CREATE UNIQUE INDEX uq_role_permission ON role_permission (role_id, permission_id);
CREATE INDEX idx_role_permission_permission_id ON role_permission (permission_id);

-- ----------------------------------------------------------------------------
-- delegation
-- ----------------------------------------------------------------------------
CREATE TABLE delegation (
  id           uuid PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES app_user (id),
  to_user_id   uuid NOT NULL REFERENCES app_user (id),
  valid_from   date NOT NULL,
  valid_until  date NOT NULL,
  scope        text[] NOT NULL,
  reason       text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_delegation_period CHECK (valid_until >= valid_from),
  CONSTRAINT chk_delegation_max_90_days CHECK (valid_until - valid_from <= 90),
  CONSTRAINT chk_delegation_not_self CHECK (from_user_id <> to_user_id)
);

COMMENT ON TABLE delegation IS
  'Approval-authority delegation (FR-X-007). The 90-day ceiling (rule 1) is enforced here at the database level. The no-re-delegation rule (rule 2: a recipient cannot delegate further) and the forbidden-role-combination check (rule 4) both require looking up the recipient''s other delegations/roles and are enforced in the application repository layer, consistent with CLAUDE.md''s "authorization filtering lives in the repository, not the controller" rule.';

CREATE INDEX idx_delegation_to_user_active ON delegation (to_user_id, is_active);
CREATE INDEX idx_delegation_from_user_id ON delegation (from_user_id);

-- ============================================================================
-- 6. Session -- FR-X-002 (not in the ERD)
-- ============================================================================
CREATE TABLE session (
  id                  uuid PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES app_user (id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  last_active_at      timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz NOT NULL,
  idle_expires_at     timestamptz NOT NULL,
  ip_address          varchar(45) NOT NULL,
  user_agent          text,
  refresh_token_hash  varchar(64) NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  revoked_at          timestamptz,
  revoked_by_user_id  uuid REFERENCES app_user (id),
  revoke_reason       varchar(40),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_session_revoke_reason CHECK (
    revoke_reason IS NULL OR revoke_reason IN (
      'LOGOUT', 'REMOTE_TERMINATION', 'IDLE_TIMEOUT', 'ABSOLUTE_TIMEOUT', 'ADMIN_FORCE', 'ROLE_CHANGE'
    )
  )
);

COMMENT ON TABLE session IS
  'Persisted login session (FR-X-002). Deliberately not stateless-JWT-only: the 30-minute idle timeout, the 12-hour absolute timeout, and remote termination of another active session all require a server-side record the API can check (and revoke) on every request.';
COMMENT ON COLUMN session.refresh_token_hash IS
  'SHA-256 hash (via pgcrypto digest()) of the refresh token, computed by the application before insert. The raw token is never stored.';
COMMENT ON COLUMN session.idle_expires_at IS
  'Denormalized copy of last_active_at + 30 minutes, recomputed by the application on every authenticated request, so an indexed cleanup/expiry job does not need to recompute it per row.';

CREATE UNIQUE INDEX uq_session_refresh_token_hash ON session (refresh_token_hash);
CREATE INDEX idx_session_user_active ON session (user_id, is_active);
CREATE INDEX idx_session_idle_expires_at ON session (idle_expires_at) WHERE is_active;
CREATE INDEX idx_session_absolute_expires_at ON session (absolute_expires_at) WHERE is_active;

-- ============================================================================
-- 7. Uploaded file -- FR-X-013 (not in the ERD)
-- ============================================================================
CREATE TABLE uploaded_file (
  id                  uuid PRIMARY KEY,
  uploaded_by_user_id uuid NOT NULL REFERENCES app_user (id),
  original_file_name  text NOT NULL,
  sanitized_file_name text NOT NULL,
  storage_key         text NOT NULL,
  file_size           bigint NOT NULL,
  declared_mime_type  varchar(255),
  detected_mime_type  varchar(255),
  sha256              varchar(64) NOT NULL,
  scan_status         file_scan_status NOT NULL DEFAULT 'MENUNGGU_PEMINDAIAN',
  scan_completed_at   timestamptz,
  scan_engine_version varchar(100),
  quarantined_at      timestamptz,
  purpose             varchar(30) NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_uploaded_file_size CHECK (file_size > 0 AND file_size <= 104857600),
  CONSTRAINT chk_uploaded_file_sha256 CHECK (sha256 ~ '^[a-f0-9]{64}$')
);

COMMENT ON TABLE uploaded_file IS
  'Raw upload/scan tracking record (FR-X-013), independent of whichever business object (evidence version, document version -- Modul A/C, not yet built) later references it via storage_key. chk_uploaded_file_size enforces the 100 MB per-file ceiling (rule 2); the 500 MB per-request aggregate ceiling is a cross-row check owned by the application. A file may only be downloaded once scan_status = BERSIH (rule 4); that gate is enforced in the download service, since the database has no concept of a "download" action to intercept.';
COMMENT ON COLUMN uploaded_file.detected_mime_type IS
  'Populated from the file''s magic number (rule 3), never trusted from declared_mime_type or the file extension.';
COMMENT ON COLUMN uploaded_file.quarantined_at IS
  'Set when scan_status transitions to TERINFEKSI (rule 5). The row is never deleted; it stays queryable by SYS_ADMIN/SEC_OFFICER.';

CREATE UNIQUE INDEX uq_uploaded_file_storage_key ON uploaded_file (storage_key);
CREATE INDEX idx_uploaded_file_sha256 ON uploaded_file (sha256);
CREATE INDEX idx_uploaded_file_scan_status ON uploaded_file (scan_status);
CREATE INDEX idx_uploaded_file_uploaded_by ON uploaded_file (uploaded_by_user_id);

-- ============================================================================
-- 8. Notification -- FR-X-010, FR-X-011 (not in the ERD)
-- ============================================================================
CREATE TABLE notification (
  id                uuid PRIMARY KEY,
  recipient_user_id uuid NOT NULL REFERENCES app_user (id),
  code              varchar(10) NOT NULL,
  title             text NOT NULL,
  body              text,
  object_type       varchar(50),
  object_id         uuid,
  can_be_summarized boolean NOT NULL,
  is_read           boolean NOT NULL DEFAULT false,
  read_at           timestamptz,
  email_status      varchar(20) NOT NULL DEFAULT 'TIDAK_BERLAKU',
  email_attempts    smallint NOT NULL DEFAULT 0,
  email_failed_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_notification_code CHECK (code ~ '^NT-[0-9]{2}$'),
  CONSTRAINT chk_notification_email_status CHECK (
    email_status IN ('TIDAK_BERLAKU', 'ANTRE', 'TERKIRIM', 'GAGAL')
  ),
  CONSTRAINT chk_notification_email_attempts CHECK (email_attempts <= 3)
);

COMMENT ON TABLE notification IS
  'In-app inbox item, one row per (recipient, event) (FR-X-010, FR-X-011 -- NT-01..NT-28). Email delivery status is tracked on the same row (email_status/email_attempts) because both channels originate from a single event per the notification matrix. can_be_summarized is snapshotted at creation time from the FR-X-011 matrix so a later template edit cannot silently change the digestibility of an already-sent notification.';
COMMENT ON COLUMN notification.code IS
  'Pattern-checked (NT-nn) rather than a closed enum, since FR-X-010 rule 1 allows COMPLIANCE to edit notification templates -- new codes should not require a schema migration.';

CREATE INDEX idx_notification_recipient_unread ON notification (recipient_user_id, is_read);
CREATE INDEX idx_notification_code ON notification (code);
CREATE INDEX idx_notification_object ON notification (object_type, object_id);

-- ----------------------------------------------------------------------------
-- notification_preference
-- ----------------------------------------------------------------------------
CREATE TABLE notification_preference (
  id                 uuid PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES app_user (id),
  default_frequency  notification_frequency NOT NULL DEFAULT 'SEKETIKA',
  category_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_preference IS
  'Per-user notification delivery preference (FR-X-010 rule 2). Escalation/deadline-missed categories (NT-03, NT-07, NT-08, NT-10, NT-11, NT-13, NT-14, NT-16, NT-21, NT-24, NT-27 per the FR-X-011 matrix) can never be summarized or muted; that restriction is enforced in the application layer against the fixed matrix, not by category_overrides.';

CREATE UNIQUE INDEX uq_notification_preference_user_id ON notification_preference (user_id);

-- ============================================================================
-- 9. audit_log -- ADR-04, FR-X-008, critical control K-7
--
-- Nothing that is not part of locking this table down may appear between
-- CREATE TABLE and the REVOKE block below. That gap is exactly the window
-- ADR-04 exists to eliminate: any statement in between would run against an
-- audit_log that is (however briefly, within this same transaction) not yet
-- protected.
-- ============================================================================
CREATE TABLE audit_log (
  id                   bigserial PRIMARY KEY,
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  actor_id             uuid NOT NULL REFERENCES app_user (id),
  actor_role_at_action text[] NOT NULL,
  session_id           uuid REFERENCES session (id),
  request_id           text,
  action               varchar(100) NOT NULL,
  object_type          varchar(50) NOT NULL,
  object_id            uuid NOT NULL,
  before_value         jsonb,
  after_value          jsonb,
  ip_address           varchar(45),
  prev_hash            text,
  hash                 text NOT NULL
);

COMMENT ON TABLE audit_log IS
  'Append-only, hash-chained audit trail (ADR-04, FR-X-008, critical control K-7). actor_role_at_action, session_id and request_id are additions required by FR-X-008 rule 1 that are NOT present in the docs/04-TRD.md Sec 3.1 ERD diagram -- this is a deliberate, documented deviation (see packages/db/README.md) because the FRD is the more detailed, normative ("HARUS") source. These three columns are intentionally OUTSIDE the hash formula: ADR-04 line 286 defines exactly seven components (prev hash, time, actor, action, object, before, after), and extending that formula without explicit sign-off would mean inventing a different concatenation order, which the task instructions explicitly forbid.';
COMMENT ON COLUMN audit_log.actor_role_at_action IS
  'Snapshot of the actor''s effective roles at the moment of the action (FR-X-005 rule 1: a user may hold several simultaneous roles; 07-API-CONTRACT.md Sec 3.5 shows this as a plural effective_roles array). Stored as an array despite the singular column name mandated by the task spec.';
COMMENT ON COLUMN audit_log.object_id IS
  'NOT NULL: every audited action must identify what it acted on (FR-X-008 rule 1). For actions without a natural business object (e.g. login), the convention is to reference the acting app_user itself.';

-- ----------------------------------------------------------------------------
-- 9.1 Immutability trigger (ADR-04)
-- ----------------------------------------------------------------------------
-- search_path is pinned on every function in this file. Without it, pg_temp is
-- searched first for relation names, and any role holding TEMP on the database
-- -- which sigap_app does by default -- can shadow audit_log with a temporary
-- table of its own and change what these functions see.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log bersifat hanya-tambah (ADR-04). Operasi % ditolak.', TG_OP;
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

-- TRUNCATE is neither UPDATE nor DELETE: it fires neither trigger above and it
-- empties the table in one statement. A row-level trigger cannot catch it --
-- there are no rows to iterate -- so this one is FOR EACH STATEMENT.
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();

-- ----------------------------------------------------------------------------
-- 9.2 Privilege lockdown (ADR-04) -- trigger AND revoke, not either/or.
-- The revoke stops the operation from ever reaching the trigger; the trigger
-- protects against the day someone re-grants the privilege by mistake.
--
-- TRUNCATE is named explicitly in the REVOKE. It is not implied by DELETE, and
-- omitting it leaves the loudest possible hole behind the quietest wording.
-- ----------------------------------------------------------------------------
REVOKE ALL ON audit_log FROM PUBLIC;
GRANT INSERT, SELECT ON audit_log TO sigap_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM sigap_app;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO sigap_app;

-- Hand audit_log to the unreachable owner. Everything above ran as the
-- migration role, which needed ownership to create the table and its triggers;
-- from here on nobody holds it. This must stay AFTER the triggers are created
-- and BEFORE the migration ends.
--
-- PostgreSQL requires the caller to be a member of the incoming owner role, so
-- the migration role joins sigap_owner. That is safe precisely because the
-- migration role is NOT the runtime role -- see directUrl in schema.prisma.
-- Running migrations as sigap_app would hand it this membership and defeat the
-- whole section.
DO $$
BEGIN
  EXECUTE format('GRANT sigap_owner TO %I', current_user);
END
$$;

ALTER TABLE audit_log OWNER TO sigap_owner;
ALTER FUNCTION reject_audit_log_mutation() OWNER TO sigap_owner;

-- ----------------------------------------------------------------------------
-- 9.3 Indexes (docs/04-TRD.md Sec 3.6)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_audit_log_object ON audit_log (object_type, object_id, occurred_at);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_id, occurred_at);
CREATE INDEX idx_audit_log_session_id ON audit_log (session_id);

-- ----------------------------------------------------------------------------
-- 9.4 Hash chain (ADR-04 line 286)
--
--   hash(n) = SHA256( hash(n-1) ⋮ time ⋮ actor ⋮ action ⋮ object_type
--                      ⋮ object_id ⋮ before_value ⋮ after_value )
--
-- SEPARATORS ARE PART OF THE CONTROL, NOT FORMATTING.
--
-- The first version of this function concatenated the components directly and
-- COALESCEd every nullable input to ''. That made distinct events hash
-- identically. The one that mattered:
--
--   before=NULL, after={"role":"SYS_ADMIN"}   -- granting yourself SYS_ADMIN
--   before={"role":"SYS_ADMIN"}, after=NULL   -- revoking it from yourself
--
-- Both produced the same SHA-256. An attacker who could write to the table
-- could swap the two columns and turn "I granted myself admin" into "I revoked
-- my own admin" without recomputing a single downstream hash, and the chain
-- verifier would still report valid. Detecting exactly that kind of tampering
-- is the entire reason the chain exists.
--
-- Two changes close it. U+001E (record separator) is placed between every
-- component; it cannot occur in a UUID, in the fixed timestamp format, or in
-- jsonb::text output, which Postgres emits with escaped control characters.
-- And NULL is encoded as a distinct marker rather than '', so an absent value
-- is never indistinguishable from an empty one.
--
-- Time is normalized to UTC with microsecond precision before formatting, so
-- the hash does not depend on the session TimeZone setting.
--
-- CHANGING THIS FORMULA AFTER THE FIRST PRODUCTION ROW EXISTS IS IMPOSSIBLE:
-- every prior hash would have to be recomputed, and audit_log cannot be
-- updated -- by design. It is cheap now and never again.
--
-- This function is the ONLY place the concatenation order may be defined.
-- Application code (AuditService) calls it -- or replicates it verbatim,
-- never differently -- to compute hash at insert time; verify_audit_chain
-- below calls the exact same function to recompute and compare.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sigap_audit_hash(
  p_prev_hash    text,
  p_occurred_at  timestamptz,
  p_actor_id     uuid,
  p_action       text,
  p_object_type  text,
  p_object_id    uuid,
  p_before_value jsonb,
  p_after_value  jsonb
) RETURNS text AS $$
  SELECT encode(
    digest(
      -- Separators are written as escape sequences on purpose. E'\x1E' is
      -- ASCII RS (record separator) and E'\x1F' is US (unit separator).
      -- Neither can occur in a uuid, in the fixed timestamp format above, or in
      -- jsonb::text -- PostgreSQL escapes control characters as \uXXXX there.
      -- Do not paste raw control bytes into this file: a literal NUL is not a
      -- valid PostgreSQL string literal and would fail the migration outright.
      --
      -- concat_ws supplies the separator only. It must NOT be relied on to skip
      -- NULLs, which is why every argument is COALESCEd to a distinct marker
      -- first -- an absent value must never hash the same as an empty one.
      concat_ws(
        E'\x1E',
        COALESCE(p_prev_hash, E'\x1FGENESIS'),
        to_char(p_occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        COALESCE(p_actor_id::text, E'\x1FNULL'),
        COALESCE(p_action, E'\x1FNULL'),
        COALESCE(p_object_type, E'\x1FNULL'),
        COALESCE(p_object_id::text, E'\x1FNULL'),
        COALESCE(p_before_value::text, E'\x1FNULL'),
        COALESCE(p_after_value::text, E'\x1FNULL')
      ),
      'sha256'
    ),
    'hex'
  );
$$ LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public;

COMMENT ON FUNCTION sigap_audit_hash IS
  'Canonical implementation of ADR-04 line 286. See the comment block immediately above this function for the formula, the separator rule, and why this is the single source of truth for the concatenation order. Never call digest() on audit fields anywhere else.';

REVOKE EXECUTE ON FUNCTION sigap_audit_hash FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sigap_audit_hash TO sigap_app;
ALTER FUNCTION sigap_audit_hash OWNER TO sigap_owner;

-- ----------------------------------------------------------------------------
-- 9.5 Chain verification (FR-X-008 rule 5)
--
-- Recomputes every row's hash over [p_from_id, p_to_id] using
-- sigap_audit_hash and checks both (a) hash correctness and (b) prev_hash
-- linkage against the row immediately preceding it -- including the row just
-- before p_from_id, so a truncated range cannot hide a broken link sitting
-- exactly at its boundary. Exposed to the application via
-- POST /api/v1/audit-logs/verify-chain, restricted to COMPLIANCE/AUDIT_LEAD
-- at the application layer (RBAC is not modeled at the database level here).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_audit_chain(p_from_id bigint, p_to_id bigint)
RETURNS TABLE (
  verified_from bigint,
  verified_to   bigint,
  is_valid      boolean,
  broken_at     bigint,
  rows_checked  bigint
) AS $$
DECLARE
  v_row           RECORD;
  v_expected_hash text;
  v_prev_hash     text;
  v_broken_at     bigint := NULL;
  v_rows_checked  bigint := 0;
BEGIN
  SELECT hash INTO v_prev_hash FROM public.audit_log WHERE id < p_from_id ORDER BY id DESC LIMIT 1;

  FOR v_row IN
    SELECT id, occurred_at, actor_id, action, object_type, object_id, before_value, after_value, prev_hash, hash
    FROM public.audit_log
    WHERE id BETWEEN p_from_id AND p_to_id
    ORDER BY id ASC
  LOOP
    v_rows_checked := v_rows_checked + 1;

    IF v_row.prev_hash IS DISTINCT FROM v_prev_hash THEN
      v_broken_at := v_row.id;
      EXIT;
    END IF;

    v_expected_hash := sigap_audit_hash(
      v_prev_hash, v_row.occurred_at, v_row.actor_id, v_row.action,
      v_row.object_type, v_row.object_id, v_row.before_value, v_row.after_value
    );

    IF v_expected_hash IS DISTINCT FROM v_row.hash THEN
      v_broken_at := v_row.id;
      EXIT;
    END IF;

    v_prev_hash := v_row.hash;
  END LOOP;

  RETURN QUERY SELECT p_from_id, p_to_id, (v_broken_at IS NULL), v_broken_at, v_rows_checked;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public;

COMMENT ON FUNCTION verify_audit_chain IS
  'Chain integrity verification over an id range (FR-X-008 rule 5). See the comment block immediately above this function for the exact semantics.';

REVOKE EXECUTE ON FUNCTION verify_audit_chain FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_audit_chain TO sigap_app;
ALTER FUNCTION verify_audit_chain OWNER TO sigap_owner;

-- ============================================================================
-- 10. Baseline application grants for every OTHER foundation table.
--
-- audit_log is intentionally excluded from this list -- its privileges were
-- already set explicitly in Sec 9.2 above and must never be widened by a
-- broad statement like this one.
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organization_unit,
  employee,
  app_user,
  role,
  permission,
  role_permission,
  user_role,
  delegation,
  session,
  uploaded_file,
  notification,
  notification_preference
TO sigap_app;

-- ----------------------------------------------------------------------------
-- 11. Belt-and-suspenders: re-affirm the audit_log restriction as the very
-- last statement in this migration, so nothing above (now or added by a
-- future edit of this file) can silently reopen it (ADR-04 / K-7).
-- ----------------------------------------------------------------------------
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM sigap_app;
