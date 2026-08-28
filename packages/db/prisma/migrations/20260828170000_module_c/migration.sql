-- ============================================================================
-- SIGAP -- Modul C (Policy Hub) migration -- document registry, lifecycle,
-- versioning, access rules, and the hybrid search index.
--
-- Hand-written (not `prisma migrate dev` output), same convention as the
-- foundation, Modul B and Modul A migrations.
--
-- Source of truth: docs/03-FRD.md FR-C-001 s.d. FR-C-012, FR-C-022;
-- docs/04-TRD.md Sec 3.4 (ERD Modul C), Sec 3.6 (indeks), Sec 4 (rancangan
-- pencarian hibrida), ADR-02 (pencarian di dalam PostgreSQL).
--
-- SCOPE. Six tables (document, document_version, document_chunk,
-- document_access, document_control_link, document_search_miss), one text
-- search configuration, one access-check function, and their grants.
--
-- OUT OF SCOPE, deliberately. The approval workflow tables (FR-C-005) and the
-- attestation campaign tables (FR-C-019 s.d. FR-C-021) are not here. This
-- migration lands the spine -- a document that can be authored, versioned,
-- brought into force, superseded, and found -- because that is what every
-- later FR-C requirement stands on. Approval and attestation are additive
-- tables on top of it, not changes to it.
--
-- APPLICATION-VERSION SAFETY: CREATE-only. No column is added to, and nothing
-- is dropped from, any earlier table, so it is safe to apply before, during,
-- or after any apps/api rollout that does not yet know about Modul C.
--
-- CONCURRENTLY: every table here is created fresh and is empty for the whole
-- migration, so plain CREATE INDEX is correct and cheap.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Section 0 -- enum types
--
-- document_status is the state machine drawn in FR-C-004, spelled out as a
-- database type rather than a varchar so an impossible state cannot be written
-- at all. The hierarchy in FR-C-001 aturan 2 (Kebijakan > Pedoman > SOP >
-- Instruksi Kerja) is NOT encoded in the enum's ordering: relying on enum sort
-- order for a governance rule hides it where nobody reads it, so the ranking
-- lives in one named table in application code instead.
-- ---------------------------------------------------------------------------

CREATE TYPE document_type AS ENUM (
  'KEBIJAKAN',
  'PEDOMAN',
  'SOP',
  'INSTRUKSI_KERJA',
  'SURAT_EDARAN',
  'MEMO_INTERNAL',
  'FORMULIR',
  'LAMPIRAN_TEKNIS'
);

CREATE TYPE document_status AS ENUM (
  'DRAF',
  'DALAM_PENELAAHAN',
  'MENUNGGU_PENGESAHAN',
  'DISAHKAN',
  'BERLAKU',
  'DALAM_REVISI',
  'DIGANTIKAN',
  'DITARIK'
);

-- FR-C-002: the process areas of a securities company, verbatim.
CREATE TYPE process_area AS ENUM (
  'DEALING',
  'SETTLEMENT',
  'KUSTODIAN',
  'RISET',
  'PEMASARAN',
  'KEUANGAN_AKUNTANSI',
  'SDM',
  'TI',
  'KEPATUHAN',
  'MANAJEMEN_RISIKO',
  'AUDIT_INTERNAL',
  'UMUM'
);

CREATE TYPE document_access_subject AS ENUM ('UNIT', 'JABATAN', 'PERAN', 'KARYAWAN');
CREATE TYPE document_access_level AS ENUM ('BACA', 'UNDUH');

-- ---------------------------------------------------------------------------
-- Section 1 -- Bahasa Indonesia text search configuration
--
-- docs/04-TRD.md Sec 4.3 and FR-C-009 rule 1 require an Indonesian full-text
-- configuration. PostgreSQL ships no `indonesian` dictionary, so this builds
-- one named `indonesian_simple` on top of `simple` (no language stemmer, no
-- English stopwords) plus `unaccent` so "kebijakan" and "kebijakan" written
-- with stray diacritics fold together.
--
-- WHY NOT `english`. The English Snowball stemmer mangles Indonesian: it
-- strips a trailing "s" ("kelas" -> "kela") and treats Indonesian function
-- words as content. `simple` keeps whole words, which for a corpus of formal
-- Indonesian normative documents retrieves better than a wrong-language
-- stemmer. Indonesian affix stripping (meN-, ber-, -kan, -an) is a real
-- improvement to make later, but it belongs in a dictionary of its own and is
-- not worth faking with the English one now.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'indonesian_simple') THEN
    CREATE TEXT SEARCH CONFIGURATION indonesian_simple (COPY = simple);
    ALTER TEXT SEARCH CONFIGURATION indonesian_simple
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
  END IF;
END
$$;

COMMENT ON TEXT SEARCH CONFIGURATION indonesian_simple IS
  'FR-C-009 aturan 1 / 04-TRD Sec 4.3. Konfigurasi pencarian teks Bahasa Indonesia: simple + unaccent. Sengaja BUKAN english -- stemmer Inggris merusak kata Indonesia (kelas -> kela). Pemenggalan imbuhan Indonesia menyusul sebagai kamus tersendiri.';

-- ---------------------------------------------------------------------------
-- Section 2 -- document
--
-- The normative document itself: identity, ownership, taxonomy and review
-- cycle. Content does NOT live here; it lives in document_version, because
-- FR-C-006 keeps every version and FR-C-007 rule 3 must answer "which version
-- was in force on date X". A document row is the stable identity that survives
-- across versions.
-- ---------------------------------------------------------------------------

CREATE TABLE document (
  id                  uuid PRIMARY KEY,
  -- FR-C-003: optional at creation (a draft may not have a number assigned
  -- yet), but unique once set. Partial-unique via a plain UNIQUE, which in
  -- PostgreSQL already permits many NULLs.
  document_no         varchar(100) UNIQUE,
  title               varchar(300) NOT NULL,
  document_type       document_type NOT NULL,
  owner_org_unit_id   uuid NOT NULL REFERENCES organization_unit (id),
  owner_employee_id   uuid NOT NULL REFERENCES employee (id),
  -- FR-C-003 aturan 1 & FR-X-018 aturan 1: classification is mandatory and has
  -- NO DEFAULT. The absence of a DEFAULT clause is the enforcement: an INSERT
  -- that forgets it fails loudly instead of silently filing a confidential
  -- document as PUBLIK.
  classification      classification NOT NULL,
  process_area        process_area NOT NULL,
  tags                text[] NOT NULL DEFAULT '{}',
  summary             text,
  -- FR-C-008 aturan 1: default cycle per type, resolved by the application at
  -- creation and stored per document so a later change to the type default
  -- does not silently re-date documents already in force.
  review_cycle_months integer NOT NULL,
  next_review_date    date,
  status              document_status NOT NULL DEFAULT 'DRAF',
  -- FR-C-004 aturan 2: set when a newer version takes force.
  superseded_by_id    uuid REFERENCES document (id),
  -- FR-C-004 aturan 4: withdrawal needs a recorded reason. Enforced by the
  -- CHECK below rather than left to the service, because a withdrawn document
  -- with no reason is exactly the audit gap this system exists to close.
  withdrawn_reason    text,
  withdrawn_at        timestamptz,
  created_by          uuid NOT NULL REFERENCES app_user (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_document_withdrawn_reason
    CHECK (status <> 'DITARIK' OR (withdrawn_reason IS NOT NULL AND withdrawn_at IS NOT NULL)),
  CONSTRAINT ck_document_review_cycle_positive
    CHECK (review_cycle_months > 0)
);

COMMENT ON TABLE document IS
  'FR-C-001/002/003 · dokumen normatif: identitas, kepemilikan, taksonomi, siklus tinjauan. Isi dokumen ada di document_version, bukan di sini, karena FR-C-006 menyimpan seluruh versi dan FR-C-007 aturan 3 harus dapat menjawab versi mana yang berlaku pada tanggal tertentu.';

COMMENT ON COLUMN document.classification IS
  'FR-X-018 aturan 1 & FR-C-003 aturan 1: wajib, TANPA nilai bawaan. Ketiadaan DEFAULT adalah penegakannya.';

-- 04-TRD Sec 3.6: GIN on tags, plus the composite used by every filtered read.
CREATE INDEX idx_document_tags ON document USING gin (tags);
CREATE INDEX idx_document_status_classification_unit
  ON document (status, classification, owner_org_unit_id);
CREATE INDEX idx_document_owner_employee_id ON document (owner_employee_id);
CREATE INDEX idx_document_next_review_date ON document (next_review_date);
-- FR-C-011: filtering by type and process area is the two most-used filters.
CREATE INDEX idx_document_type_process_area ON document (document_type, process_area);
-- Trigram on the title so FR-C-012 aturan 1 (spelling suggestions) and
-- title-boosted ranking (FR-C-009 aturan 4) do not sequential-scan.
CREATE INDEX idx_document_title_trgm ON document USING gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Section 3 -- document_version
--
-- FR-C-006: every version is kept. FR-C-007: each carries its own force
-- window, and the pair (effective_from, effective_until) is what answers "what
-- was in force on date X" for an audit of a past period.
-- ---------------------------------------------------------------------------

CREATE TABLE document_version (
  id               uuid PRIMARY KEY,
  document_id      uuid NOT NULL REFERENCES document (id),
  -- FR-C-006 aturan 1: mayor.minor. Stored as two integers rather than a
  -- string so "2.10 comes after 2.9" is true, which it is not for text sort.
  version_major    integer NOT NULL,
  version_minor    integer NOT NULL,
  storage_key      varchar(500),
  -- FR-C-003 aturan 2: extracted for search. NULL means extraction has not run
  -- or failed; aturan 3 then marks the document as not content-searchable.
  extracted_text   text,
  body             text,
  -- FR-C-006 aturan 4: mandatory change summary, enforced by NOT NULL.
  change_summary   text NOT NULL,
  effective_from   date,
  effective_until  date,
  approved_at      timestamptz,
  status           document_status NOT NULL DEFAULT 'DRAF',
  created_by       uuid NOT NULL REFERENCES app_user (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_document_version_no UNIQUE (document_id, version_major, version_minor),
  CONSTRAINT ck_document_version_no_positive
    CHECK (version_major >= 1 AND version_minor >= 0),
  -- FR-C-007 aturan 1: a force date earlier than the ratification date would
  -- mean a document that bound people before it was approved.
  CONSTRAINT ck_document_version_effective_after_approval
    CHECK (effective_from IS NULL OR approved_at IS NULL OR effective_from >= approved_at::date),
  CONSTRAINT ck_document_version_window
    CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until >= effective_from)
);

COMMENT ON TABLE document_version IS
  'FR-C-006/007 · satu versi dokumen beserta jendela berlakunya. Nomor versi disimpan sebagai dua integer, bukan teks, agar 2.10 benar-benar setelah 2.9.';

CREATE INDEX idx_document_version_document_id ON document_version (document_id);
CREATE INDEX idx_document_version_status ON document_version (status);
-- FR-C-007 aturan 3: "which version was in force on date X" scans this.
CREATE INDEX idx_document_version_effective
  ON document_version (document_id, effective_from, effective_until);

-- FR-C-004 aturan 2/3: at most ONE version of a document may be BERLAKU at a
-- time. When a new version takes force the previous one becomes DIGANTIKAN in
-- the same statement, with no gap. A partial unique index makes the invariant
-- structural: a bug that forgets to supersede raises an error instead of
-- quietly leaving two conflicting procedures in force, which for an operating
-- procedure is a governance failure, not a data glitch.
CREATE UNIQUE INDEX uq_document_version_one_in_force
  ON document_version (document_id)
  WHERE status = 'BERLAKU';

COMMENT ON INDEX uq_document_version_one_in_force IS
  'FR-C-004 aturan 2/3: paling banyak SATU versi berstatus BERLAKU per dokumen. Invarian ditegakkan basis data, bukan diserahkan ke service.';

-- ---------------------------------------------------------------------------
-- Section 4 -- document_chunk
--
-- 04-TRD Sec 4.1: structure-aware chunks, each carrying a human-readable
-- section_ref because FR-C-013 requires citations to point at the right
-- article. content_tsv and content_embedding sit on the SAME row (Sec 3.5) so
-- one query can filter by entitlement and rank by both keyword and meaning.
--
-- content_embedding is nullable and stays NULL until a local embedding model
-- is wired in (ADR-03: embeddings are always local). The keyword branch works
-- without it, and the semantic branch simply contributes nothing while it is
-- NULL rather than the search being unavailable.
-- ---------------------------------------------------------------------------

CREATE TABLE document_chunk (
  id                  uuid PRIMARY KEY,
  document_version_id uuid NOT NULL REFERENCES document_version (id),
  chunk_index         integer NOT NULL,
  -- 04-TRD Sec 4.1 butir 3, e.g. "Bab III Pasal 12 ayat (2)".
  section_ref         varchar(200),
  content             text NOT NULL,
  -- Generated, not maintained by the application: a tsvector the service has
  -- to remember to refresh is a tsvector that silently goes stale.
  content_tsv         tsvector GENERATED ALWAYS AS (
                        to_tsvector('indonesian_simple', coalesce(content, ''))
                      ) STORED,
  content_embedding   vector(768),
  token_count         integer,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_document_chunk_version_index UNIQUE (document_version_id, chunk_index)
);

COMMENT ON TABLE document_chunk IS
  '04-TRD Sec 4.1 · penggalan sadar struktur. content_tsv dan content_embedding pada baris yang sama (Sec 3.5) agar penyaringan hak akses, pencarian kata kunci, dan pencarian makna terjadi dalam satu kueri.';

COMMENT ON COLUMN document_chunk.content_embedding IS
  'ADR-03: vektor selalu dibentuk model lokal. NULL selama model lokal belum terpasang; cabang makna tidak menyumbang apa-apa saat NULL, dan pencarian kata kunci tetap jalan.';

-- 04-TRD Sec 3.6: GIN for keyword, HNSW (cosine) for meaning.
CREATE INDEX idx_document_chunk_tsv ON document_chunk USING gin (content_tsv);
CREATE INDEX idx_document_chunk_version_id ON document_chunk (document_version_id);
CREATE INDEX idx_document_chunk_embedding
  ON document_chunk USING hnsw (content_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Section 5 -- document_access
--
-- FR-C-010 aturan 2: access is decided by classification, owner unit, granted
-- units, job titles, and named individuals. This table holds the explicit
-- grants; classification and owner unit live on `document` itself.
-- ---------------------------------------------------------------------------

CREATE TABLE document_access (
  id           uuid PRIMARY KEY,
  document_id  uuid NOT NULL REFERENCES document (id),
  subject_type document_access_subject NOT NULL,
  -- Polymorphic by subject_type: an org_unit id, an employee id, or NULL when
  -- the subject is a job title or a role, which are matched by name.
  subject_id   uuid,
  subject_name varchar(200),
  access_level document_access_level NOT NULL DEFAULT 'BACA',
  granted_by   uuid NOT NULL REFERENCES app_user (id),
  granted_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_document_access_subject
    CHECK (
      (subject_type IN ('UNIT', 'KARYAWAN') AND subject_id IS NOT NULL)
      OR (subject_type IN ('JABATAN', 'PERAN') AND subject_name IS NOT NULL)
    )
);

COMMENT ON TABLE document_access IS
  'FR-C-010 aturan 2 · pemberian akses eksplisit atas dokumen. Klasifikasi dan unit pemilik ada di tabel document; tabel ini menampung unit, jabatan, peran, dan individu yang ditunjuk.';

CREATE INDEX idx_document_access_document_id ON document_access (document_id);
CREATE INDEX idx_document_access_subject ON document_access (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Section 6 -- document_control_link (FR-C-022)
--
-- The bridge to Modul A: which audit control a document underpins. Same shape
-- as the Modul B evidence bridge -- a governance platform earns its keep when
-- the procedure, the control, and the evidence point at each other.
-- ---------------------------------------------------------------------------

CREATE TABLE document_control_link (
  id          uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES document (id),
  control_id  uuid NOT NULL REFERENCES control (id),
  note        text,
  linked_by   uuid NOT NULL REFERENCES app_user (id),
  linked_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_document_control_link UNIQUE (document_id, control_id)
);

COMMENT ON TABLE document_control_link IS
  'FR-C-022 · penautan dokumen normatif ke kontrol audit Modul A.';

CREATE INDEX idx_document_control_link_control_id ON document_control_link (control_id);

-- ---------------------------------------------------------------------------
-- Section 7 -- document_search_miss (FR-C-012 aturan 4)
--
-- A search that returned nothing is the most valuable signal about which
-- document does not exist or is misnamed. Recorded so content gaps can be
-- analysed rather than guessed at.
-- ---------------------------------------------------------------------------

CREATE TABLE document_search_miss (
  id           bigserial PRIMARY KEY,
  query_text   text NOT NULL,
  user_id      uuid REFERENCES app_user (id),
  filters      jsonb NOT NULL DEFAULT '{}',
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE document_search_miss IS
  'FR-C-012 aturan 4 · pencarian nihil dicatat untuk analisis kesenjangan konten. Bukan jejak audit (bukan peristiwa tata kelola), jadi tidak masuk audit_log.';

CREATE INDEX idx_document_search_miss_occurred_at ON document_search_miss (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Section 8 -- check_document_access(document_id, user_id)
--
-- The single access predicate, referenced by name in 04-TRD Sec 4.2. It lives
-- in the database rather than in application code for one reason: FR-C-010
-- aturan 1 says a forbidden document must not appear in the results, in the
-- result COUNT, or in suggestions. A predicate that every query is obliged to
-- join against cannot be forgotten by one query path the way a service-layer
-- filter can -- which is exactly kode aturan #1 (filtering at the repository
-- layer), pushed one level further down.
--
-- STABLE, not VOLATILE, so the planner may call it once per row and cache
-- within a statement. SECURITY INVOKER (the default) on purpose: it reads only
-- tables sigap_app can already read, and it must not become a privilege
-- escalation route.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_document_access(p_document_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH doc AS (
    SELECT d.id, d.classification, d.owner_org_unit_id, d.owner_employee_id
    FROM document d
    WHERE d.id = p_document_id
  ),
  me AS (
    SELECT u.id AS user_id, e.id AS employee_id, e.org_unit_id, e.job_title
    FROM app_user u
    LEFT JOIN employee e ON e.id = u.employee_id
    WHERE u.id = p_user_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM doc, me
    WHERE
      -- PUBLIK and INTERNAL are readable by any authenticated internal user
      -- (FR-X-018: "untuk seluruh karyawan"). An EXTERNAL account has no
      -- employee row and therefore falls through to the explicit grants below,
      -- which is the intended behaviour for an invited external auditor.
      (doc.classification IN ('PUBLIK', 'INTERNAL') AND me.employee_id IS NOT NULL)
      -- The owner, and the owning unit, always retain access.
      OR doc.owner_employee_id = me.employee_id
      OR doc.owner_org_unit_id = me.org_unit_id
      -- Explicit grants: unit, named individual, job title, or role.
      OR EXISTS (
        SELECT 1 FROM document_access a
        WHERE a.document_id = doc.id
          AND (
            (a.subject_type = 'UNIT'     AND a.subject_id = me.org_unit_id)
            OR (a.subject_type = 'KARYAWAN' AND a.subject_id = me.employee_id)
            OR (a.subject_type = 'JABATAN'  AND a.subject_name = me.job_title)
            OR (a.subject_type = 'PERAN'    AND EXISTS (
                  SELECT 1 FROM user_role ur
                  JOIN role r ON r.id = ur.role_id
                  WHERE ur.user_id = me.user_id
                    AND r.code = a.subject_name
                    AND (ur.valid_until IS NULL OR ur.valid_until >= now())
               ))
          )
      )
  );
$$;

COMMENT ON FUNCTION check_document_access(uuid, uuid) IS
  'FR-C-010 · satu-satunya predikat hak akses dokumen, dirujuk 04-TRD Sec 4.2. Ada di basis data supaya tidak ada jalur kueri yang bisa lupa memakainya: dokumen terlarang tidak boleh muncul di hasil, di jumlah hasil, maupun di saran.';

GRANT EXECUTE ON FUNCTION check_document_access(uuid, uuid) TO sigap_app;

-- ---------------------------------------------------------------------------
-- Section 9 -- grants
--
-- Ordinary business tables: full DML for the runtime role. audit_log remains
-- the only append-only table (K-7); nothing here changes that.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON
  document,
  document_version,
  document_chunk,
  document_access,
  document_control_link,
  document_search_miss
TO sigap_app;

GRANT USAGE, SELECT ON SEQUENCE document_search_miss_id_seq TO sigap_app;
