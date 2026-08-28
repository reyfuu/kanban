-- ============================================================================
-- SIGAP -- Modul A (Evidence Vault) migration -- stage 2
--
-- Hand-written, same convention as earlier migrations.
--
-- Source of truth: docs/04-TRD.md Sec 3.2 (Modul A ERD), docs/03-FRD.md
-- FR-A-004..017, docs/07-API-CONTRACT.md Sec 4.3..4.6, docs/10-TEST-PLAN.md
-- Sec 3.2 critical control K-8 (evidence integrity).
--
-- SCOPE: engagements, evidence + versions + links, request items, findings,
-- remediations. Retention/legal-hold enforcement, external-auditor portal and
-- object-lock storage wiring are the remaining Modul A slices.
--
-- APPLICATION-VERSION SAFETY: only CREATEs new objects.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum types (docs/04-TRD.md Sec 3.2, docs/03-FRD.md FR-X-018)
-- ----------------------------------------------------------------------------
CREATE TYPE classification AS ENUM ('PUBLIK', 'INTERNAL', 'TERBATAS', 'RAHASIA');
CREATE TYPE engagement_type AS ENUM (
  'AUDIT_INTERNAL', 'AUDIT_EKSTERNAL', 'PEMERIKSAAN_REGULATOR', 'SELF_ASSESSMENT',
  'SERTIFIKASI', 'AUDIT_INDUK', 'TINJAUAN_MANAJEMEN'
);
CREATE TYPE engagement_status AS ENUM (
  'PERENCANAAN', 'BERJALAN', 'PELAPORAN', 'SELESAI', 'PEMANTAUAN', 'DITUTUP',
  'DITANGGUHKAN', 'DIBATALKAN'
);
CREATE TYPE request_item_status AS ENUM (
  'DRAF', 'TERBIT', 'DISERAHKAN', 'DALAM_PENELAAHAN', 'INFO_TAMBAHAN', 'SELESAI', 'TIDAK_BERLAKU'
);
CREATE TYPE evidence_status AS ENUM (
  'DRAF', 'DISERAHKAN', 'DITERIMA', 'DITOLAK', 'KEDALUWARSA', 'DIARSIPKAN'
);
CREATE TYPE evidence_source AS ENUM ('UNGGAHAN_MANUAL', 'KONEKTOR', 'DIBANGKITKAN_SISTEM');
CREATE TYPE evidence_link_target AS ENUM ('REQUEST_ITEM', 'CONTROL', 'FINDING', 'ENGAGEMENT', 'CAMPAIGN');
CREATE TYPE finding_lifecycle AS ENUM (
  'DRAF', 'DIKOMUNIKASIKAN', 'DISEPAKATI', 'DISANGGAH', 'DALAM_PERBAIKAN',
  'MENUNGGU_VERIFIKASI', 'DITUTUP', 'DITERIMA_SEBAGAI_RISIKO', 'DIBATALKAN'
);

-- ----------------------------------------------------------------------------
-- 2. engagement -- FR-A-004, FR-A-005 (ERD followed; period_covered daterange
--    split into two date columns to keep Prisma-mappable).
-- ----------------------------------------------------------------------------
CREATE TABLE engagement (
  id               uuid PRIMARY KEY,
  code             varchar(50) NOT NULL,
  title            varchar(300) NOT NULL,
  engagement_type  engagement_type NOT NULL,
  period_from      date NOT NULL,
  period_to        date NOT NULL,
  fieldwork_start  date,
  fieldwork_end    date,
  lead_auditor_id  uuid NOT NULL REFERENCES app_user (id),
  status           engagement_status NOT NULL DEFAULT 'PERENCANAAN',
  legal_hold       boolean NOT NULL DEFAULT false,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_engagement_code UNIQUE (code),
  CONSTRAINT chk_engagement_period CHECK (period_to >= period_from)
);

COMMENT ON TABLE engagement IS
  'Audit/assessment engagement (FR-A-004, FR-A-005). code is generated <TYPE>-<YEAR>-<seq> by the application. The lifecycle (FR-A-005) is enforced by the EngagementService transition table; the CHECK here only guards the period. Team scoping (rule 3) is engagement_member; a member sees only engagements they are on, AUDIT_LEAD/COMPLIANCE see all.';

CREATE INDEX idx_engagement_status ON engagement (status);
CREATE INDEX idx_engagement_lead_auditor_id ON engagement (lead_auditor_id);

CREATE TABLE engagement_member (
  id            uuid PRIMARY KEY,
  engagement_id uuid NOT NULL REFERENCES engagement (id),
  user_id       uuid NOT NULL REFERENCES app_user (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_engagement_member UNIQUE (engagement_id, user_id)
);
CREATE INDEX idx_engagement_member_user_id ON engagement_member (user_id);

CREATE TABLE engagement_control (
  id            uuid PRIMARY KEY,
  engagement_id uuid NOT NULL REFERENCES engagement (id),
  control_id    uuid NOT NULL REFERENCES control (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_engagement_control UNIQUE (engagement_id, control_id)
);
CREATE INDEX idx_engagement_control_control_id ON engagement_control (control_id);

-- ----------------------------------------------------------------------------
-- 3. evidence + evidence_version -- FR-A-010, FR-A-011. Critical control K-8.
--
-- The two unique constraints on evidence_version are the enforceable half of
-- K-8: uq_evidence_version_no forbids two rows claiming the same version of one
-- evidence (versions never overwrite), and uq_evidence_version_sha256 forbids
-- the same content being stored twice under one evidence (FR-A-011 rule 2 --
-- an identical re-upload must be offered as a link, not a copy). The SHA-256 is
-- computed on receipt and re-verified on download in the service; object-lock
-- storage (rule 3) is wired when the storage backend is added.
-- ----------------------------------------------------------------------------
CREATE TABLE evidence (
  id                 uuid PRIMARY KEY,
  title              varchar(300) NOT NULL,
  description        text,
  evidence_type      varchar(100) NOT NULL,
  validity_from      date,
  validity_to        date,
  owner_org_unit_id  uuid REFERENCES organization_unit (id),
  classification     classification NOT NULL,
  source             evidence_source NOT NULL,
  system_generated   boolean NOT NULL DEFAULT false,
  status             evidence_status NOT NULL DEFAULT 'DRAF',
  current_version_no integer NOT NULL DEFAULT 0,
  created_by         uuid NOT NULL REFERENCES app_user (id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_evidence_validity CHECK (validity_to IS NULL OR validity_from IS NULL OR validity_to >= validity_from)
);

COMMENT ON TABLE evidence IS
  'Evidence as a first-class entity (FR-A-010), not an attachment: it survives its links (FR-A-010 rules 2 and 3). classification has no default (FR-X-018 rule 1). system_generated evidence (FR-A-014) cannot be edited by users -- enforced in the service.';

CREATE INDEX idx_evidence_classification ON evidence (classification);
CREATE INDEX idx_evidence_status ON evidence (status);

CREATE TABLE evidence_version (
  id            uuid PRIMARY KEY,
  evidence_id   uuid NOT NULL REFERENCES evidence (id),
  version_no    integer NOT NULL,
  storage_key   varchar(500) NOT NULL,
  file_name     varchar(300) NOT NULL,
  file_size     bigint NOT NULL,
  mime_type     varchar(200) NOT NULL,
  sha256        varchar(64) NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES app_user (id),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  scan_status   file_scan_status NOT NULL DEFAULT 'MENUNGGU_PEMINDAIAN',
  CONSTRAINT uq_evidence_version_no UNIQUE (evidence_id, version_no),
  CONSTRAINT uq_evidence_version_sha256 UNIQUE (evidence_id, sha256)
);

COMMENT ON TABLE evidence_version IS
  'Immutable evidence file version (FR-A-011, critical control K-8). uq_evidence_version_no: versions never overwrite. uq_evidence_version_sha256: an identical re-upload is refused and offered as a link (rule 2). sha256 verified on download (rule 4); a mismatch raises a security alert. Downloadable only when scan_status = BERSIH.';

CREATE INDEX idx_evidence_version_evidence_id ON evidence_version (evidence_id);

CREATE TABLE evidence_link (
  id          uuid PRIMARY KEY,
  evidence_id uuid NOT NULL REFERENCES evidence (id),
  target_type evidence_link_target NOT NULL,
  target_id   uuid NOT NULL,
  note        text,
  linked_by   uuid NOT NULL REFERENCES app_user (id),
  linked_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_evidence_link_target UNIQUE (evidence_id, target_type, target_id)
);

COMMENT ON TABLE evidence_link IS
  'A link from evidence to a request item, control, finding, engagement or campaign (FR-A-010 rule 1). target_id carries no database FOREIGN KEY because it is polymorphic across five tables; referential integrity for each target_type is checked in the application. Unlinking (delete) never touches the evidence (rule 2).';

CREATE INDEX idx_evidence_link_target ON evidence_link (target_type, target_id);

-- ----------------------------------------------------------------------------
-- 4. request_item -- FR-A-006, FR-A-007.
-- ----------------------------------------------------------------------------
CREATE TABLE request_item (
  id                       uuid PRIMARY KEY,
  engagement_id            uuid NOT NULL REFERENCES engagement (id),
  sequence_no              integer NOT NULL,
  description              text NOT NULL,
  control_id               uuid REFERENCES control (id),
  evidence_period_from     date,
  evidence_period_to       date,
  responsible_org_unit_id  uuid REFERENCES organization_unit (id),
  pic_employee_id          uuid NOT NULL REFERENCES employee (id),
  due_date                 date NOT NULL,
  expected_evidence_type   varchar(100),
  is_mandatory             boolean NOT NULL DEFAULT true,
  status                   request_item_status NOT NULL DEFAULT 'DRAF',
  review_note              text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_request_item_sequence UNIQUE (engagement_id, sequence_no)
);

COMMENT ON TABLE request_item IS
  'Evidence request / PBC item (FR-A-006, FR-A-007). sequence_no is unique within an engagement. A DRAF request is invisible to the PIC (rule 4) -- filtered in the service. The lifecycle (FR-A-007) and the "review to SELESAI only by AUDITOR_INT/AUDIT_LEAD" rule are enforced by RequestItemService.';

CREATE INDEX idx_request_item_engagement_id ON request_item (engagement_id);
CREATE INDEX idx_request_item_pic_employee_id ON request_item (pic_employee_id);
CREATE INDEX idx_request_item_status ON request_item (status);

-- ----------------------------------------------------------------------------
-- 5. finding + remediation -- FR-A-016, FR-A-017.
-- ----------------------------------------------------------------------------
CREATE TABLE finding (
  id                uuid PRIMARY KEY,
  engagement_id     uuid NOT NULL REFERENCES engagement (id),
  code              varchar(50) NOT NULL,
  title             varchar(300) NOT NULL,
  condition_text    text NOT NULL,
  criteria_text     text,
  cause_text        text,
  effect_text       text,
  recommendation    text,
  risk_level        risk_level_type NOT NULL,
  owner_employee_id uuid REFERENCES employee (id),
  due_date          date,
  status            finding_lifecycle NOT NULL DEFAULT 'DRAF',
  recurring_of_id   uuid REFERENCES finding (id),
  risk_accepted_by  uuid REFERENCES app_user (id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_finding_code UNIQUE (code)
);

COMMENT ON TABLE finding IS
  'Audit finding (FR-A-016, FR-A-017). risk_level drives the default follow-up SLA (rule 2). recurring_of_id links to a prior-period finding (rule 3). The lifecycle -- including "closed only by AUDIT_LEAD with remediation evidence" and "Diterima Sebagai Risiko needs director sign-off" -- is enforced by FindingService.';

CREATE INDEX idx_finding_engagement_id ON finding (engagement_id);
CREATE INDEX idx_finding_status ON finding (status);

CREATE TABLE remediation (
  id                uuid PRIMARY KEY,
  finding_id        uuid NOT NULL REFERENCES finding (id),
  description       text NOT NULL,
  owner_employee_id uuid NOT NULL REFERENCES employee (id),
  due_date          date NOT NULL,
  verified_by       uuid REFERENCES app_user (id),
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_remediation_finding_id ON remediation (finding_id);

-- ----------------------------------------------------------------------------
-- 6. Application grants.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  engagement,
  engagement_member,
  engagement_control,
  evidence,
  evidence_version,
  evidence_link,
  request_item,
  finding,
  remediation
TO sigap_app;
