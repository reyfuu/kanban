-- ============================================================================
-- SIGAP -- Modul B (Access Review) migration -- campaign evidence package
--
-- Hand-written (not `prisma migrate dev` output), same convention as the
-- foundation, Modul B and Modul A migrations.
--
-- Source of truth: docs/03-FRD.md FR-B-022, FR-B-023; docs/07-API-CONTRACT.md
-- Sec 5.9.
--
-- SCOPE: one table, campaign_evidence_package, plus its grants. It is the
-- frozen, point-in-time assembly of a closed campaign's evidence pack
-- (FR-B-022) together with the pack's own cryptographic fingerprint (rule 3)
-- and a pointer to the Modul A evidence entity it was registered as (FR-B-023,
-- the cross-module bridge). The Modul A entity itself (evidence,
-- evidence_version, evidence_link) already exists from the Modul A stage-2
-- migration; nothing there changes.
--
-- WHY A DEDICATED TABLE. The pack is an attestation, and rule 3 gives it a
-- fingerprint. A fingerprint over data that is recomputed on every read is a
-- fingerprint over nothing: reopen a sign-off or land a newer snapshot after
-- the campaign closes and a recomputed pack would no longer match its own
-- hash. So the assembled contents are frozen here at generation time, and the
-- read path returns exactly what was signed, never a fresh recomputation.
--
-- APPLICATION-VERSION SAFETY: CREATE-only. It adds no column to, and drops
-- nothing from, any earlier table, so it is safe to apply before, during, or
-- after any apps/api rollout that does not yet know about the pack.
--
-- CONCURRENTLY: the table is created fresh here and is empty for the whole
-- migration, so plain CREATE INDEX is fine.
-- ============================================================================

CREATE TABLE campaign_evidence_package (
  id            uuid PRIMARY KEY,
  -- One pack per campaign. A campaign closes once (FR-B-010), so a second
  -- generation is a conflict, not a new row. The UNIQUE makes that structural
  -- rather than a check the service has to remember.
  campaign_id   uuid NOT NULL UNIQUE REFERENCES review_campaign (id),
  -- The Modul A evidence entity this pack was registered as (FR-B-023). The
  -- bridge that turns an access certification into audit-control evidence.
  evidence_id   uuid NOT NULL REFERENCES evidence (id),
  title         varchar(300) NOT NULL,
  -- FR-B-022 rule 3: the pack's own fingerprint, over the frozen contents
  -- below. Same U+001E-separated, sorted construction as the sign-off and
  -- audit-chain fingerprints, for the same reason.
  content_hash  varchar(64) NOT NULL,
  -- The frozen eight sections (FR-B-022): scope + methodology + every decision
  -- with its reason, sign-off records with fingerprints, revocation status,
  -- exceptions, anomalies, and FR-B-014 flagged reviewers. Read back verbatim.
  contents      jsonb NOT NULL,
  generated_by  uuid NOT NULL REFERENCES app_user (id),
  generated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaign_evidence_package IS
  'Frozen, point-in-time assembly of a closed campaign''s evidence pack (FR-B-022) plus the pack''s own fingerprint (rule 3) and a pointer to the Modul A evidence entity it was registered as (FR-B-023). One per campaign (a campaign closes once). contents is frozen at generation so content_hash keeps meaning; the read path returns it verbatim rather than recomputing, because a fingerprint over recomputed data proves nothing.';

COMMENT ON COLUMN campaign_evidence_package.content_hash IS
  'FR-B-022 rule 3: SHA-256 over the frozen contents, built with the same U+001E field separator and sorted-member construction as the sign-off fingerprint. Two different packs cannot serialise to the same bytes.';

CREATE INDEX idx_campaign_evidence_package_evidence_id ON campaign_evidence_package (evidence_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_evidence_package TO sigap_app;
