-- ============================================================================
-- SIGAP -- LLM Gateway (ADR-03, FR-C-013 s.d. FR-C-018).
--
-- Hand-written, same convention as every migration before it.
--
-- Source of truth: docs/03-FRD.md FR-C-014 s.d. FR-C-018; docs/04-TRD.md
-- ADR-03, where this path is named the most critical control point in the
-- architecture because it is the ONLY route by which internal data leaves the
-- company's control.
--
-- SCOPE: one enum, two tables, one seeded settings row, grants.
--
-- WHY THE SETTINGS ROW LIVES IN THE DATABASE. FR-C-017 aturan 1 requires
-- COMPLIANCE to be able to switch answer generation off "dalam hitungan detik
-- tanpa perlu penempatan ulang aplikasi". An environment variable cannot
-- satisfy that: changing one means restarting the process. A row can be
-- updated by a Compliance Officer through the API and takes effect on the very
-- next request.
--
-- WHY IT IS SEEDED DISABLED. ADR-03 lists seven preconditions (G1..G7 --
-- regional endpoint, no-retention agreement, credentials in a secret store,
-- rotation schedule, proxy allow-list, budget cap, review schedule) that
-- Compliance must verify BEFORE the feature is activated. Defaulting to
-- enabled would mean a fresh deployment starts sending data to an external
-- provider before anyone has checked any of them. The safe default for an
-- egress path is off.
--
-- WHY REJECTIONS ARE LOGGED AS FULLY AS SUCCESSES. FR-C-016 aturan 3. A log
-- containing only what was sent cannot answer the question Compliance actually
-- asks, which is whether the gate ever refused anything and why.
--
-- APPLICATION-VERSION SAFETY: CREATE-only. Nothing existing is altered, so an
-- older application version continues to run unchanged against this schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Section 1 -- enum
--
-- Every distinct way a request can end, including each refusal reason
-- separately. Collapsing the refusals into one DITOLAK value would make
-- "the classification gate is doing its job" indistinguishable from "the
-- provider is down", which are opposite conclusions about system health.
-- ---------------------------------------------------------------------------

CREATE TYPE llm_gateway_outcome AS ENUM (
  'DITERUSKAN',
  'DITOLAK_PEMUTUS',
  'DITOLAK_KLASIFIKASI',
  'DITOLAK_REDAKSI',
  'DITOLAK_TANPA_RUJUKAN',
  'DITOLAK_BATAS',
  'GAGAL_PENYEDIA'
);

-- ---------------------------------------------------------------------------
-- Section 2 -- the gateway log (FR-C-016)
-- ---------------------------------------------------------------------------

CREATE TABLE llm_request_log (
  id                 UUID PRIMARY KEY,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  asked_by_user_id   UUID NOT NULL,
  question_raw       TEXT NOT NULL,
  question_redacted  TEXT,
  outcome            llm_gateway_outcome NOT NULL,
  refusal_reason     TEXT,
  chunks_referenced  JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_sent       JSONB,
  response_received  JSONB,
  provider_name      VARCHAR(100),
  tokens_prompt      INTEGER,
  tokens_completion  INTEGER,
  cost_micros        BIGINT,
  duration_ms        INTEGER,

  CONSTRAINT fk_llm_request_log_asker
    FOREIGN KEY (asked_by_user_id) REFERENCES app_user (id),

  -- A refusal must say why. Without this, a row can record that something was
  -- blocked while losing the only field that explains it, and the log stops
  -- being usable as evidence that the control operated correctly.
  CONSTRAINT chk_llm_request_log_refusal_reason CHECK (
    outcome = 'DITERUSKAN' OR refusal_reason IS NOT NULL
  ),

  -- Nothing may be recorded as forwarded without the payload that was
  -- forwarded. FR-C-016 requires the sent payload to be retained, and a
  -- "DITERUSKAN" row with no payload would assert that a send happened while
  -- destroying the only proof of what was in it.
  CONSTRAINT chk_llm_request_log_payload CHECK (
    outcome <> 'DITERUSKAN' OR payload_sent IS NOT NULL
  )
);

COMMENT ON TABLE llm_request_log IS
  'FR-C-016 · catatan lengkap tiap permintaan ke penyedia bahasa eksternal, termasuk yang DITOLAK gerbang (aturan 3). Disimpan minimal 24 bulan (aturan 1).';

COMMENT ON COLUMN llm_request_log.chunks_referenced IS
  'Dokumen + potongan yang dirujuk beserta klasifikasinya PADA SAAT PENGIRIMAN. Sengaja jsonb dan bukan tabel relasi: ini rekaman tak berubah tentang apa yang benar saat itu, bukan relasi hidup yang boleh ikut berubah bila dokumennya diklasifikasi ulang kemudian.';

COMMENT ON COLUMN llm_request_log.cost_micros IS
  'Biaya dalam satuan mikro. Bilangan bulat, bukan pecahan: akumulasi galat pecahan pada angka uang akhirnya menggeser perhitungan anggaran K8.';

CREATE INDEX idx_llm_request_log_occurred_at ON llm_request_log (occurred_at);
CREATE INDEX idx_llm_request_log_asker ON llm_request_log (asked_by_user_id);
CREATE INDEX idx_llm_request_log_outcome ON llm_request_log (outcome);

-- ---------------------------------------------------------------------------
-- Section 3 -- the kill switch and budget (FR-C-017, ADR-03 K8)
-- ---------------------------------------------------------------------------

CREATE TABLE llm_gateway_setting (
  id                                UUID PRIMARY KEY,
  enabled                           BOOLEAN NOT NULL DEFAULT false,
  disabled_reason                   TEXT,
  disabled_by                       UUID,
  disabled_at                       TIMESTAMPTZ,
  max_requests_per_user_per_hour    INTEGER NOT NULL DEFAULT 20,
  monthly_budget_micros             BIGINT NOT NULL DEFAULT 0,
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_llm_gateway_setting_disabled_by
    FOREIGN KEY (disabled_by) REFERENCES app_user (id),

  CONSTRAINT chk_llm_gateway_setting_rate CHECK (max_requests_per_user_per_hour > 0),
  CONSTRAINT chk_llm_gateway_setting_budget CHECK (monthly_budget_micros >= 0)
);

-- Exactly one row, enforced by the database rather than by convention. A
-- second row would create the question "which setting is live", and the answer
-- would be decided by whatever ORDER BY the reading code happened to use --
-- for a kill switch, an unacceptable way to decide whether egress is open.
CREATE UNIQUE INDEX uq_llm_gateway_setting_singleton ON llm_gateway_setting ((true));

COMMENT ON TABLE llm_gateway_setting IS
  'FR-C-017 · pemutus layanan. Satu baris. Di basis data, bukan di konfigurasi, karena aturan 1 menuntut penonaktifan berlaku dalam hitungan detik tanpa penempatan ulang.';

-- Seeded OFF. See the header: ADR-03 G1..G7 must be verified by Compliance
-- before this becomes true.
INSERT INTO llm_gateway_setting (id, enabled, disabled_reason, monthly_budget_micros)
VALUES (
  '00000000-0000-4000-8000-00000000c017',
  false,
  'Belum diaktifkan: syarat G1-G7 ADR-03 belum diverifikasi Divisi Kepatuhan.',
  0
);

-- ---------------------------------------------------------------------------
-- Section 4 -- grants
--
-- No DELETE on llm_request_log, for the same reason audit_log has none (K-7):
-- a record of what left the company that the application can quietly remove is
-- not evidence of anything. UPDATE is granted because a row is written before
-- the provider call and completed with the response, tokens and cost after it.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON llm_request_log TO sigap_app;
GRANT SELECT, UPDATE ON llm_gateway_setting TO sigap_app;
