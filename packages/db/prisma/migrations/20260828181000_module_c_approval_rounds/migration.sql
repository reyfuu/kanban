-- ============================================================================
-- SIGAP -- Modul C · ronde pengajuan pada alur persetujuan.
--
-- Source of truth: docs/03-FRD.md FR-C-005 aturan 6.
--
-- WHY THIS EXISTS. Found by an integration test, not by review: the first cut
-- of document_approval_step made (version, kind, order, assignee) unique, so a
-- flow that was rejected or stopped left its rows occupying those slots and the
-- author could never resubmit the same version. The document sat in Draf
-- permanently -- exactly the state aturan 6 assumes is recoverable.
--
-- The fix is a round counter, not a delete. Deleting the rejected rows would
-- erase why it was rejected, and that is the first thing an auditor asks about
-- a document that needed three attempts.
--
-- APPLICATION-VERSION SAFETY: the column has a DEFAULT, so rows written by an
-- older application version land in round 1 and stay valid. The UNIQUE it
-- replaces is strictly weaker, so nothing previously accepted becomes invalid.
-- ============================================================================

ALTER TABLE document_approval_step
  ADD COLUMN round integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN document_approval_step.round IS
  'Percobaan pengajuan ke berapa. Alur yang ditolak atau dihentikan tetap tersimpan; pengajuan berikutnya membuka ronde baru. Menghapus ronde lama akan menghapus catatan penolakannya — justru pertanyaan pertama seorang auditor atas dokumen yang baru disahkan pada percobaan ketiga.';

ALTER TABLE document_approval_step
  DROP CONSTRAINT uq_document_approval_step_slot;

ALTER TABLE document_approval_step
  ADD CONSTRAINT uq_document_approval_step_slot
    UNIQUE (document_version_id, round, kind, step_order, assignee_employee_id);

CREATE INDEX idx_document_approval_step_round
  ON document_approval_step (document_version_id, round DESC);
