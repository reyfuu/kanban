-- ============================================================================
-- SIGAP -- Modul C · alur persetujuan berjenjang (FR-C-005).
--
-- Hand-written, same convention as every migration before it.
--
-- Source of truth: docs/03-FRD.md FR-C-005, FR-C-004 (the states these steps
-- move a document between), FR-X-003 (re-authentication on ratification), and
-- docs/04-TRD.md Sec 3.4, where APPROVAL_STEP hangs off DOCUMENT_VERSION.
--
-- SCOPE: one table, document_approval_step, plus a template table that makes
-- the flow configurable per document type and unit (FR-C-005's opening
-- sentence), and their grants.
--
-- WHY THE STEPS ARE MATERIALISED, NOT COMPUTED. The flow is configurable, so
-- it is tempting to resolve "who approves this" at read time from the template.
-- That would be wrong for the same reason a recomputed evidence-package hash is
-- wrong: an approval is a historical fact about who actually agreed, and the
-- template changes. A document ratified last year must keep showing the people
-- who ratified it, in the order that applied then, even after the template is
-- edited. So the template is copied into concrete steps when the flow starts,
-- and nothing rewrites them afterwards.
--
-- APPLICATION-VERSION SAFETY: CREATE-only. It adds no column to and drops
-- nothing from any earlier table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Section 1 -- enums
-- ---------------------------------------------------------------------------

/*
 * FR-C-005 aturan 1 & 2 · reviewers may run in parallel, approvers are always
 * sequential. The distinction is not cosmetic: a review gathers opinions, and
 * gathering them at once is faster with no loss; ratification is a chain of
 * authority, and letting a higher tier sign before a lower one inverts the
 * hierarchy the signature is supposed to represent.
 */
CREATE TYPE approval_step_kind AS ENUM ('PENELAAHAN', 'PENGESAHAN');

CREATE TYPE approval_step_status AS ENUM (
  'MENUNGGU',
  'SETUJU',
  'DIKEMBALIKAN',
  'DITOLAK',
  'DILEWATI',
  'DIBATALKAN'
);

-- ---------------------------------------------------------------------------
-- Section 2 -- document_approval_template
--
-- FR-C-005 opening sentence: the flow is configurable per document type and
-- per unit. A NULL org_unit_id is the fallback that applies to any unit, so a
-- deployment can define one company-wide ladder and override it only where a
-- division genuinely differs.
-- ---------------------------------------------------------------------------

CREATE TABLE document_approval_template (
  id             uuid PRIMARY KEY,
  document_type  document_type NOT NULL,
  -- NULL = applies to every unit that has no more specific template.
  org_unit_id    uuid REFERENCES organization_unit (id),
  kind           approval_step_kind NOT NULL,
  -- Position in the ladder. Reviewers sharing a sequence run in parallel;
  -- approvers are validated to be strictly sequential by the service.
  step_order     integer NOT NULL,
  -- Who: a named employee, or a role code resolved at flow start. Exactly one,
  -- enforced below -- a template that names neither cannot produce a step, and
  -- one that names both is ambiguous about who is actually accountable.
  employee_id    uuid REFERENCES employee (id),
  role_code      varchar(50),
  /*
   * FR-C-006 aturan 2 · a minor, editorial revision MAY skip part of the
   * approval ladder. Marking which steps are skippable belongs to the template
   * rather than to a hard-coded rule, because which tier may be skipped is a
   * governance decision that differs per document type.
   */
  skip_on_minor  boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_document_approval_template_subject
    CHECK ((employee_id IS NOT NULL) <> (role_code IS NOT NULL)),
  CONSTRAINT ck_document_approval_template_order CHECK (step_order >= 1)
);

COMMENT ON TABLE document_approval_template IS
  'FR-C-005 · konfigurasi alur telaah dan pengesahan per jenis dokumen dan unit. org_unit_id NULL berarti berlaku bagi unit mana pun yang tidak punya templat lebih khusus.';

COMMENT ON COLUMN document_approval_template.skip_on_minor IS
  'FR-C-006 aturan 2: langkah yang boleh dilewati untuk perubahan redaksional (minor). Keputusan tata kelola, jadi ditaruh di templat, bukan dikodekan.';

CREATE UNIQUE INDEX uq_document_approval_template_slot
  ON document_approval_template (document_type, COALESCE(org_unit_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, step_order, COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(role_code, ''))
  WHERE is_active;

CREATE INDEX idx_document_approval_template_lookup
  ON document_approval_template (document_type, org_unit_id, kind, step_order)
  WHERE is_active;

-- ---------------------------------------------------------------------------
-- Section 3 -- document_approval_step
--
-- One concrete step on one version: who must act, in what order, and what they
-- decided. Frozen at flow start (see the header note).
-- ---------------------------------------------------------------------------

CREATE TABLE document_approval_step (
  id                  uuid PRIMARY KEY,
  document_version_id uuid NOT NULL REFERENCES document_version (id),
  kind                approval_step_kind NOT NULL,
  step_order          integer NOT NULL,
  /*
   * The person the step was assigned to when the flow started.
   * FR-C-005 aturan 5 redirects an inactive assignee to their delegate or
   * manager; when that happens the redirect is recorded in acted_by and
   * redirected_from rather than by overwriting this column, so the trail shows
   * both who was supposed to act and who actually did.
   */
  assignee_employee_id uuid NOT NULL REFERENCES employee (id),
  redirected_from_employee_id uuid REFERENCES employee (id),
  redirect_reason     varchar(200),
  status              approval_step_status NOT NULL DEFAULT 'MENUNGGU',
  /*
   * FR-C-005 aturan 3 · every decision carries a comment, and a rejection
   * requires a reason. Enforced here, not in the service: an approval with no
   * recorded rationale is the audit gap this module exists to close, and a
   * database that permits it will eventually contain one.
   */
  comment             text,
  acted_by            uuid REFERENCES app_user (id),
  acted_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_document_approval_step_slot
    UNIQUE (document_version_id, kind, step_order, assignee_employee_id),
  CONSTRAINT ck_document_approval_step_order CHECK (step_order >= 1),
  -- A decided step must say who decided it and when.
  CONSTRAINT ck_document_approval_step_acted
    CHECK (
      status = 'MENUNGGU'
      OR status = 'DILEWATI'
      OR status = 'DIBATALKAN'
      OR (acted_by IS NOT NULL AND acted_at IS NOT NULL)
    ),
  -- FR-C-005 aturan 3: returning or rejecting without a reason is refused.
  CONSTRAINT ck_document_approval_step_reason
    CHECK (
      status NOT IN ('DIKEMBALIKAN', 'DITOLAK')
      OR (comment IS NOT NULL AND length(btrim(comment)) >= 10)
    ),
  CONSTRAINT ck_document_approval_step_redirect
    CHECK (
      redirected_from_employee_id IS NULL
      OR redirect_reason IS NOT NULL
    )
);

COMMENT ON TABLE document_approval_step IS
  'FR-C-005 · satu langkah telaah/pengesahan pada satu versi dokumen. Dibekukan saat alur dimulai: persetujuan adalah fakta historis tentang siapa yang benar-benar setuju, dan templatnya bisa berubah. Dokumen yang disahkan tahun lalu tetap harus menampilkan pengesah yang berlaku saat itu.';

COMMENT ON CONSTRAINT ck_document_approval_step_reason ON document_approval_step IS
  'FR-C-005 aturan 3: penolakan dan pengembalian wajib disertai alasan. Ditegakkan basis data karena persetujuan tanpa rationale tercatat adalah celah audit yang justru ingin ditutup modul ini.';

CREATE INDEX idx_document_approval_step_version
  ON document_approval_step (document_version_id, kind, step_order);
-- The "my approval queue" read: everything still waiting on one person.
CREATE INDEX idx_document_approval_step_assignee_pending
  ON document_approval_step (assignee_employee_id)
  WHERE status = 'MENUNGGU';

-- ---------------------------------------------------------------------------
-- Section 4 -- grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON
  document_approval_template,
  document_approval_step
TO sigap_app;
