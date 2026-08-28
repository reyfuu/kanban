-- ============================================================================
-- SIGAP -- Modul C · kampanye attestation (FR-C-019 s.d. FR-C-021).
--
-- Hand-written, same convention as every migration before it.
--
-- Source of truth: docs/03-FRD.md FR-C-019, FR-C-020, FR-C-021, FR-A-014
-- aturan 2 (the completion report becomes Modul A evidence); docs/04-TRD.md
-- Sec 3.4, where ATTESTATION_CAMPAIGN / ATTESTATION_TASK / ATTESTATION_RECORD
-- appear.
--
-- SCOPE: four tables plus grants. The one new enum value it depends on is
-- added by the preceding migration; see the note in Section 1.
--
-- WHY A TASK AND A RECORD, NOT ONE TABLE. A task is an obligation ("this
-- person must attest to this document"); a record is the fact that they did.
-- Collapsing them would make an outstanding obligation indistinguishable from
-- an absent row, and FR-C-021 is exactly the question "who has NOT attested" --
-- which is unanswerable if non-attestation has no representation.
--
-- APPLICATION-VERSION SAFETY: CREATE-only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Section 1 -- enums
-- ---------------------------------------------------------------------------

CREATE TYPE attestation_campaign_status AS ENUM (
  'DRAF',
  'BERJALAN',
  'SELESAI',
  'DIBATALKAN'
);

/*
 * FR-C-019 · target criteria. The campaign stores which rule was used and the
 * parameters it needs; the concrete people are materialised into tasks when
 * the campaign launches.
 *
 * Materialising rather than evaluating at read time matters for the same
 * reason it did for approval steps: "who was required to read this policy in
 * March" is a historical fact, and an org chart that changes afterwards must
 * not silently rewrite it.
 */
CREATE TYPE attestation_target_kind AS ENUM (
  'SELURUH_KARYAWAN',
  'UNIT',
  'JABATAN',
  'KARYAWAN_BARU',
  'DAFTAR_INDIVIDU'
);

CREATE TYPE attestation_task_status AS ENUM (
  'MENUNGGU',
  'SELESAI',
  'PERLU_NYATAKAN_ULANG',
  'DIBATALKAN'
);

-- The evidence_link_target value ATTESTATION_CAMPAIGN (FR-A-014 aturan 2) is
-- added by the migration immediately before this one, alone, because
-- PostgreSQL forbids using a newly added enum value in the same transaction.

-- ---------------------------------------------------------------------------
-- Section 2 -- attestation_campaign
-- ---------------------------------------------------------------------------

CREATE TABLE attestation_campaign (
  id             uuid PRIMARY KEY,
  name           varchar(300) NOT NULL,
  description    text,
  target_kind    attestation_target_kind NOT NULL,
  /*
   * Parameters for the target rule: org unit ids, job titles, an employee list,
   * or a joined-since date. Shape depends on target_kind and is validated by
   * the service; jsonb rather than five nullable columns because four of them
   * would always be null.
   */
  target_params  jsonb NOT NULL DEFAULT '{}',
  start_date     date NOT NULL,
  due_date       date NOT NULL,
  is_mandatory   boolean NOT NULL DEFAULT true,
  /*
   * FR-C-019 aturan 3 · a recurring campaign picks up employees who join after
   * it launched. Off by default: silently enrolling people into an obligation
   * they did not exist for is worse than a compliance officer relaunching.
   */
  auto_enroll_new_employees boolean NOT NULL DEFAULT false,
  status         attestation_campaign_status NOT NULL DEFAULT 'DRAF',
  launched_at    timestamptz,
  closed_at      timestamptz,
  created_by     uuid NOT NULL REFERENCES app_user (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_attestation_campaign_period CHECK (due_date >= start_date)
);

COMMENT ON TABLE attestation_campaign IS
  'FR-C-019 · kampanye pernyataan telah membaca. Sasaran dimaterialisasi menjadi task saat kampanye diluncurkan, bukan dievaluasi saat dibaca: "siapa yang wajib membaca kebijakan ini pada bulan Maret" adalah fakta historis, dan perubahan struktur organisasi setelahnya tidak boleh diam-diam menulis ulang jawabannya.';

CREATE INDEX idx_attestation_campaign_status ON attestation_campaign (status);
CREATE INDEX idx_attestation_campaign_due_date ON attestation_campaign (due_date);

-- ---------------------------------------------------------------------------
-- Section 3 -- attestation_campaign_document
--
-- FR-C-019 aturan 1 & 2 · which documents the campaign covers, and which
-- version each target was pointed at when it launched.
-- ---------------------------------------------------------------------------

CREATE TABLE attestation_campaign_document (
  id            uuid PRIMARY KEY,
  campaign_id   uuid NOT NULL REFERENCES attestation_campaign (id),
  document_id   uuid NOT NULL REFERENCES document (id),
  /*
   * The version in force when the campaign launched. FR-C-019 aturan 2: if the
   * document is superseded mid-campaign, this stays put and the difference
   * against the now-current version is what the system flags. Overwriting it
   * would erase the fact that people attested to different text.
   */
  version_id    uuid NOT NULL REFERENCES document_version (id),
  /* Set when a newer version takes force during the campaign. */
  superseded_noticed_at timestamptz,
  /* COMPLIANCE's decision on aturan 2: must targets attest again? */
  reattestation_required boolean NOT NULL DEFAULT false,
  reattestation_decided_at timestamptz,
  reattestation_decided_by uuid REFERENCES app_user (id),

  CONSTRAINT uq_attestation_campaign_document UNIQUE (campaign_id, document_id)
);

COMMENT ON COLUMN attestation_campaign_document.version_id IS
  'FR-C-019 aturan 2: versi yang berlaku saat kampanye diluncurkan, dibekukan. Bila dokumen digantikan di tengah kampanye, kolom ini TIDAK berubah — menimpanya akan menghapus fakta bahwa orang menyatakan telah membaca teks yang berbeda.';

CREATE INDEX idx_attestation_campaign_document_campaign
  ON attestation_campaign_document (campaign_id);

-- ---------------------------------------------------------------------------
-- Section 4 -- attestation_task
--
-- One obligation: this employee, this campaign document. Created at launch.
-- ---------------------------------------------------------------------------

CREATE TABLE attestation_task (
  id                     uuid PRIMARY KEY,
  campaign_id            uuid NOT NULL REFERENCES attestation_campaign (id),
  campaign_document_id   uuid NOT NULL REFERENCES attestation_campaign_document (id),
  employee_id            uuid NOT NULL REFERENCES employee (id),
  status                 attestation_task_status NOT NULL DEFAULT 'MENUNGGU',
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_attestation_task UNIQUE (campaign_document_id, employee_id)
);

COMMENT ON TABLE attestation_task IS
  'FR-C-019/021 · satu kewajiban membaca. Terpisah dari attestation_record karena FR-C-021 justru menanyakan siapa yang BELUM menyatakan — pertanyaan yang tidak terjawab bila ketidakhadiran pernyataan tidak punya baris sendiri.';

CREATE INDEX idx_attestation_task_campaign_status
  ON attestation_task (campaign_id, status);
CREATE INDEX idx_attestation_task_employee_pending
  ON attestation_task (employee_id)
  WHERE status IN ('MENUNGGU', 'PERLU_NYATAKAN_ULANG');

-- ---------------------------------------------------------------------------
-- Section 5 -- attestation_record
--
-- FR-C-020 · the statement itself, with the evidence that makes it meaningful.
-- ---------------------------------------------------------------------------

CREATE TABLE attestation_record (
  id                  uuid PRIMARY KEY,
  task_id             uuid NOT NULL REFERENCES attestation_task (id),
  employee_id         uuid NOT NULL REFERENCES employee (id),
  /*
   * The exact version attested to -- not the document. Someone who read version
   * 1.0 has not read version 2.0, and a record that named only the document
   * would claim otherwise.
   */
  document_version_id uuid NOT NULL REFERENCES document_version (id),
  attested_at         timestamptz NOT NULL DEFAULT now(),
  ip_address          inet,
  /*
   * FR-C-020 aturan 1 & 2 · the button only activates after the document was
   * actually opened, and for a long document, after scrolling to the end. This
   * column is the server-side record of that: an attestation with an
   * implausible dwell time is visible in the data rather than being invisible
   * because the client refused to enable a button.
   *
   * The client-side gate alone would not be a control -- anyone can post to the
   * endpoint. So the server enforces a floor too, and stores what it saw.
   */
  seconds_viewed      integer NOT NULL,
  reached_end         boolean NOT NULL DEFAULT false,
  /* FR-C-020 aturan 3 · a correction is a NEW record naming the one it corrects. */
  corrects_record_id  uuid REFERENCES attestation_record (id),
  correction_reason   text,

  CONSTRAINT ck_attestation_record_seconds CHECK (seconds_viewed >= 0),
  CONSTRAINT ck_attestation_record_correction
    CHECK (
      corrects_record_id IS NULL
      OR (correction_reason IS NOT NULL AND length(btrim(correction_reason)) >= 10)
    )
);

COMMENT ON TABLE attestation_record IS
  'FR-C-020 · pernyataan telah membaca beserta buktinya: identitas, waktu, VERSI dokumen (bukan sekadar dokumennya), alamat IP, dan lama dibuka. Pernyataan tidak dapat dibatalkan; koreksi berupa pernyataan baru yang menunjuk pernyataan lama beserta alasannya.';

COMMENT ON COLUMN attestation_record.seconds_viewed IS
  'FR-C-020 aturan 1/2: gerbang di sisi klien saja bukan kendali — siapa pun bisa memanggil titik akhirnya. Server menegakkan batas bawah dan menyimpan apa yang dilihatnya, sehingga pernyataan dengan durasi tak masuk akal terlihat di data.';

-- FR-C-020 aturan 3 · an attestation cannot be withdrawn. The application role
-- gets INSERT and SELECT only on this table; a correction is a new row.
-- This mirrors the audit_log treatment (K-7) for the same reason: a record
-- people can quietly delete is not evidence of anything.
CREATE INDEX idx_attestation_record_task ON attestation_record (task_id);
CREATE INDEX idx_attestation_record_employee ON attestation_record (employee_id);
CREATE INDEX idx_attestation_record_version ON attestation_record (document_version_id);

-- ---------------------------------------------------------------------------
-- Section 6 -- grants
--
-- Note the asymmetry on attestation_record: no UPDATE, no DELETE. FR-C-020
-- aturan 3 says a statement cannot be withdrawn, and a grant is a far stronger
-- guarantee of that than a service method that happens not to offer it.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON
  attestation_campaign,
  attestation_campaign_document,
  attestation_task
TO sigap_app;

GRANT SELECT, INSERT ON attestation_record TO sigap_app;
