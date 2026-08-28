-- ============================================================================
-- SIGAP -- Modul A (Evidence Vault) migration -- foundation slice
--
-- Hand-written (not `prisma migrate dev` output), same convention as the
-- foundation and Modul B migrations.
--
-- Source of truth: docs/04-TRD.md Sec 3.2 (Modul A ERD), docs/03-FRD.md
-- FR-A-001..003, docs/07-API-CONTRACT.md Sec 4.1/4.2.
--
-- SCOPE: this migration builds only the control-library and framework-mapping
-- foundation (control, control_version, framework, framework_item,
-- control_mapping). Evidence, evidence_version, engagement, request_item,
-- finding, remediation and external_access are deliberately deferred to a
-- later migration -- they carry K-8 (evidence integrity) and object-lock
-- requirements that deserve their own focused change.
--
-- APPLICATION-VERSION SAFETY: this migration only CREATEs new objects. It adds
-- no column to, and drops nothing from, any earlier table, so it is safe to
-- apply before, during, or after any apps/api rollout that does not yet know
-- about Modul A.
--
-- CONCURRENTLY: every table here is created fresh in this migration and is
-- empty for its entire duration, so plain CREATE INDEX is fine. CONCURRENTLY
-- becomes mandatory only once a later migration adds an index to a Modul A
-- table that already holds production data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum types (docs/04-TRD.md Sec 3.2)
-- ----------------------------------------------------------------------------
CREATE TYPE control_frequency AS ENUM ('HARIAN', 'MINGGUAN', 'BULANAN', 'TRIWULANAN', 'TAHUNAN', 'AD_HOC');
CREATE TYPE control_type AS ENUM ('PREVENTIF', 'DETEKTIF', 'KOREKTIF');
CREATE TYPE control_nature AS ENUM ('MANUAL', 'OTOMATIS', 'SEMI_OTOMATIS');
CREATE TYPE coverage_level AS ENUM ('PENUH', 'SEBAGIAN', 'MENDUKUNG');

-- ----------------------------------------------------------------------------
-- 2. control -- FR-A-001, ERD followed exactly, plus current_version and
--    expected_evidence_types (in the FR-A-001 "Atribut" list, carried here
--    because they drive the version bump and the request-item evidence hints).
-- ----------------------------------------------------------------------------
CREATE TABLE control (
  id                     uuid PRIMARY KEY,
  code                   varchar(50) NOT NULL,
  title                  varchar(300) NOT NULL,
  objective              text NOT NULL,
  owner_employee_id      uuid NOT NULL REFERENCES employee (id),
  executing_org_unit_id  uuid REFERENCES organization_unit (id),
  frequency              control_frequency NOT NULL,
  control_type           control_type NOT NULL,
  nature                 control_nature NOT NULL,
  risk_level             risk_level_type NOT NULL,
  test_procedure         text,
  expected_evidence_types text[] NOT NULL DEFAULT '{}',
  current_version        integer NOT NULL DEFAULT 1,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_control_code UNIQUE (code)
);

COMMENT ON TABLE control IS
  'Managed enterprise control (FR-A-001). code is unique and, per FR-A-001 rule 1, immutable once used on an engagement -- immutability is enforced in the application service layer (there is no natural DB constraint for "has been used" that a CHECK can see across the not-yet-built engagement_control table). FR-A-001 rule 2 (an edit to a used control produces a new version, and completed engagements keep referring to the version in force) is implemented by current_version plus the control_version snapshot table below. FR-A-001 rule 3 (retire, never delete) is is_active = false.';

CREATE INDEX idx_control_owner_employee_id ON control (owner_employee_id);
CREATE INDEX idx_control_is_active ON control (is_active);

-- ----------------------------------------------------------------------------
-- 3. control_version -- FR-A-001 rule 2. An immutable snapshot per edit.
-- ----------------------------------------------------------------------------
CREATE TABLE control_version (
  id             uuid PRIMARY KEY,
  control_id     uuid NOT NULL REFERENCES control (id),
  version_no     integer NOT NULL,
  title          varchar(300) NOT NULL,
  objective      text NOT NULL,
  frequency      control_frequency NOT NULL,
  control_type   control_type NOT NULL,
  nature         control_nature NOT NULL,
  risk_level     risk_level_type NOT NULL,
  test_procedure text,
  snapshot       jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by     uuid NOT NULL REFERENCES app_user (id),
  changed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_control_version_control_no UNIQUE (control_id, version_no)
);

COMMENT ON TABLE control_version IS
  'Immutable point-in-time snapshot of a control (FR-A-001 rule 2). Written on create (version 1) and on every subsequent edit. snapshot (jsonb) carries the full attribute set so a completed engagement can reproduce exactly the control text that was in force, independent of later schema changes to control.';

CREATE INDEX idx_control_version_control_id ON control_version (control_id);

-- ----------------------------------------------------------------------------
-- 4. framework -- FR-A-002.
-- ----------------------------------------------------------------------------
CREATE TABLE framework (
  id          uuid PRIMARY KEY,
  code        varchar(50) NOT NULL,
  name        varchar(300) NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_code UNIQUE (code)
);

COMMENT ON TABLE framework IS
  'Compliance framework (FR-A-002): OJK regulations, ISO/IEC 27001:2022 Annex A, COBIT 2019, internal policy framework. Clauses live in framework_item.';

-- ----------------------------------------------------------------------------
-- 5. framework_item -- FR-A-002 rule 2: hierarchical clauses of arbitrary
--    depth via a self-referential parent (bab -> pasal -> ayat).
-- ----------------------------------------------------------------------------
CREATE TABLE framework_item (
  id           uuid PRIMARY KEY,
  framework_id uuid NOT NULL REFERENCES framework (id),
  parent_id    uuid REFERENCES framework_item (id),
  ref          varchar(100) NOT NULL,
  title        varchar(500) NOT NULL,
  description  text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_item_framework_ref UNIQUE (framework_id, ref)
);

COMMENT ON TABLE framework_item IS
  'A single clause within a framework (FR-A-002 rule 2). parent_id gives arbitrary-depth nesting. ref is unique within its framework (e.g. "A.5.18"). A leaf item is the unit that control_mapping maps a control to, and the unit the coverage view (FR-A-003 rule 4) counts.';

CREATE INDEX idx_framework_item_framework_id ON framework_item (framework_id);
CREATE INDEX idx_framework_item_parent_id ON framework_item (parent_id);

-- ----------------------------------------------------------------------------
-- 6. control_mapping -- FR-A-003: many-to-many control <-> framework_item.
-- ----------------------------------------------------------------------------
CREATE TABLE control_mapping (
  id                uuid PRIMARY KEY,
  control_id        uuid NOT NULL REFERENCES control (id),
  framework_item_id uuid NOT NULL REFERENCES framework_item (id),
  coverage_level    coverage_level NOT NULL,
  note              text,
  mapped_by         uuid NOT NULL REFERENCES app_user (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_control_mapping_control_item UNIQUE (control_id, framework_item_id)
);

COMMENT ON TABLE control_mapping IS
  'Many-to-many mapping between a control and a framework clause (FR-A-003). The unique (control_id, framework_item_id) forbids duplicate mappings of the same pair; a control may map to many items and an item may be covered by many controls (rules 1 and 2). coverage_level is PENUH/SEBAGIAN/MENDUKUNG (rule 3). The uncovered-clause view (rule 4) is a LEFT JOIN from framework_item, computed in the application service.';

CREATE INDEX idx_control_mapping_control_id ON control_mapping (control_id);
CREATE INDEX idx_control_mapping_framework_item_id ON control_mapping (framework_item_id);

-- ----------------------------------------------------------------------------
-- 7. Application grants for every Modul A table built here.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  control,
  control_version,
  framework,
  framework_item,
  control_mapping
TO sigap_app;
