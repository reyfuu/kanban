-- ============================================================================
-- SIGAP -- Modul A (Evidence Vault) migration -- stage 3: retention
--
-- Adds retention and evidence-level legal hold (FR-A-015) to the evidence
-- table. Additive only: three nullable/defaulted columns, safe to apply before
-- or after any apps/api rollout.
--
-- Source of truth: docs/03-FRD.md FR-A-015, docs/07-API-CONTRACT.md Sec 4.5
-- (retention block).
-- ============================================================================

ALTER TABLE evidence
  ADD COLUMN legal_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN retention_until date,
  ADD COLUMN deletion_approved_at timestamptz;

COMMENT ON COLUMN evidence.legal_hold IS
  'FR-A-015 rule 3/4: a legal hold on this specific evidence. While true, retention rules do not apply and the evidence cannot enter the deletion queue -- the hold overrides retention until lifted.';
COMMENT ON COLUMN evidence.retention_until IS
  'FR-A-015 rule 1: the date this evidence becomes eligible for deletion, set when its engagement closes (default 10 years). NULL means no retention clock has started.';
COMMENT ON COLUMN evidence.deletion_approved_at IS
  'FR-A-015 rule 2: evidence past retention is never deleted automatically; this records the COMPLIANCE approval (with step-up) that removed it. A row with this set is tombstoned, not silently gone.';

CREATE INDEX idx_evidence_retention_until ON evidence (retention_until);
