# @sigap/db

Skema Prisma, migrasi SQL, dan klien PostgreSQL terkonfigurasi untuk SIGAP. Sumber kebenaran model data ada di [`docs/04-TRD.md §3`](../../docs/04-TRD.md) — paket ini mengikutinya, dengan penyimpangan yang disengaja dicatat di bawah.

## Menjalankan migrasi

> **Migrasi tidak pernah dijalankan sebagai `sigap_app`.** Peran yang menjalankan migrasi memiliki objek yang dibuatnya, dan di PostgreSQL pemilik memegang seluruh *grant option* atas objeknya secara permanen. Bila `sigap_app` memiliki `audit_log`, ia dapat memberikan `DELETE` kembali kepada dirinya sendiri, membuang pemicu, lalu mengosongkan tabel — tiga pernyataan, tanpa hak tambahan apa pun. Seluruh lapisan K-7 di bawah mengandaikan hal itu tidak terjadi.

```bash
# Instal dependensi dari root monorepo (Bun workspace)
bun install

# Dua peran, dua URL. Bedanya adalah kontrol K-7, bukan kerapian.
#   DATABASE_URL          -> peran runtime: sigap_app (INSERT+SELECT di audit_log)
#   MIGRATE_DATABASE_URL  -> peran migrasi: sigap_migrator (punya hak DDL)
export DATABASE_URL="postgresql://sigap_app:<password>@localhost:5442/sigap?schema=public"
export MIGRATE_DATABASE_URL="postgresql://sigap_migrator:<password>@localhost:5442/sigap?schema=public"

# Terapkan migrasi ke basis data pengembangan
bun run --filter @sigap/db migrate:dev

# Terapkan migrasi ke basis data staging/produksi (tanpa prompt interaktif)
bun run --filter @sigap/db migrate:deploy

# Hasilkan ulang Prisma Client setelah perubahan skema
bun run --filter @sigap/db generate

# Validasi skema tanpa koneksi basis data
bun run --filter @sigap/db validate
```

Migrasi pertama (`20260827190000_foundation`) **ditulis tangan**, bukan hasil `prisma migrate dev`. Alasannya tercatat di kepala berkas `migration.sql`: tidak ada peladen PostgreSQL yang hidup di lingkungan penulisan, dan sebagian isinya (pembuatan peran `sigap_app`, pemicu penolakan `audit_log`, fungsi rantai sidik jari) tidak dapat dihasilkan otomatis oleh Prisma sama sekali.

### Prasyarat sebelum migrasi pertama dijalankan

1. **Basis data PostgreSQL 16** sudah ada dan kosong.
2. Peran yang menjalankan migrasi memiliki hak `CREATEROLE` (untuk membuat peran `sigap_app`) dan hak memasang ekstensi (`pgvector`, `pg_trgm`, `pgcrypto`, `btree_gin`) — biasanya superuser, atau setara pada layanan PostgreSQL terkelola.
3. **Setelah** migrasi berhasil, DBA **wajib** menetapkan kata sandi peran `sigap_app` di luar berkas migrasi (mis. `ALTER ROLE sigap_app WITH PASSWORD '...'` dijalankan langsung, kata sandi disimpan di penyimpanan rahasia). Migrasi ini sengaja **tidak** menetapkan kata sandi — kredensial tidak boleh ada di riwayat git.
4. Kalau `CREATE ROLE sigap_app` gagal karena hak yang tidak cukup, migrasi akan **berhenti dengan galat**, bukan diam-diam melewatinya. Jalankan blok itu manual sebagai superuser, lalu jalankan ulang migrasi.

## Mengapa `audit_log` punya pemicu penolak

`audit_log` adalah bukti bahwa suatu peristiwa terjadi — termasuk bagi pihak yang punya akses administratif ke sistem (ADR-04, kontrol kritis **K-7** di [`docs/10-TEST-PLAN.md §3.2`](../../docs/10-TEST-PLAN.md)). Kalau baris di tabel ini bisa diubah atau dihapus lewat jalur mana pun — termasuk oleh `SYS_ADMIN` — maka tabel ini tidak lagi bisa dipercaya sebagai bukti, dan tujuan seluruh fitur jejak audit gugur.

Karena itu penegakannya berlapis tiga, bukan salah satu:

1. **Kepemilikan tabel diserahkan ke peran `sigap_owner` yang `NOLOGIN`.** Ini lapis paling bawah dan paling sering terlewat. Pencabutan hak pada butir 2 tidak bernilai apa pun bila peran yang dicabut adalah pemiliknya — pemilik selalu dapat memberikan haknya kembali. `NOLOGIN` membuat kepemilikan itu tidak dapat dicapai sesi mana pun. **Jangan pernah memberi `sigap_app` keanggotaan di `sigap_owner`**: satu `GRANT` itu membatalkan seluruh bagian ini, dan membatalkannya secara senyap — semua tes tetap lulus, karena tidak ada yang mengujinya sampai ada yang mencoba.
2. **Hak `UPDATE`/`DELETE`/`TRUNCATE` dicabut** dari peran aplikasi `sigap_app`. Ini mencegah operasi mencapai baris sama sekali — aplikasi menerima *permission denied* dari PostgreSQL sebelum pemicu sempat dievaluasi. `TRUNCATE` disebut eksplisit karena ia **tidak** tersirat oleh `DELETE`.
3. **Pemicu `BEFORE UPDATE`/`BEFORE DELETE`/`BEFORE TRUNCATE`** yang me-`RAISE EXCEPTION` tanpa syarat. Ini menjaga bila hak itu keliru diberikan kembali. Pemicu `TRUNCATE` bersifat `FOR EACH STATEMENT`, bukan `FOR EACH ROW` — `TRUNCATE` tidak menyentuh baris satu per satu, sehingga pemicu tingkat baris tidak akan pernah menyala.

Pemicu ini lebih *load-bearing* daripada tampaknya. Aksi referensial kunci asing (mis. `ON DELETE SET NULL`) dijalankan dengan hak **pemilik tabel**, bukan hak peran pemanggil — sehingga pencabutan hak pada butir 2 dilewati sepenuhnya, dan pemicu menjadi satu-satunya yang menahan.

Ketiga fungsi jejak audit juga mematok `search_path = pg_catalog, public` dan merujuk `public.audit_log` secara eksplisit. Tanpa itu, `pg_temp` didahulukan saat meresolusi nama relasi, dan peran mana pun yang memegang hak `TEMP` dapat membuat tabel sementara bernama `audit_log` sehingga `verify_audit_chain` memverifikasi tabel karangan — lalu melaporkan rantai yang rusak sebagai sah.

Ketiganya dipasang **pada migrasi yang sama** dengan pembuatan tabel, tanpa pernyataan lain di antaranya — celah waktu sekecil apa pun antara `CREATE TABLE audit_log` dan pemasangan ketiga penegakan ini adalah pelanggaran K-7, bukan detail kosmetik.

Selain itu, setiap baris menyimpan sidik jari kriptografis berantai (`hash`, `prev_hash`) sesuai rumus ADR-04:

```
hash(n) = SHA256( hash(n-1) ⋮ waktu ⋮ aktor ⋮ aksi ⋮ jenis_objek ⋮ pengenal_objek
                  ⋮ nilai_sebelum ⋮ nilai_sesudah )

⋮  = U+001E, pemisah antar-komponen
NULL dikodekan sebagai penanda tersendiri, bukan string kosong
```

Rumus ini diimplementasikan **satu kali** sebagai fungsi SQL `sigap_audit_hash(...)` (lihat migrasi §9.4) — ini satu-satunya tempat urutan penggabungan didefinisikan, supaya penghitungan saat penyisipan dan penghitungan ulang saat verifikasi tidak pernah berbeda. Fungsi `verify_audit_chain(from_id, to_id)` (§9.5) memakai fungsi yang sama untuk memeriksa rantai atas suatu rentang `id`, termasuk memeriksa keterkaitan dengan baris tepat sebelum `from_id` agar rentang yang dipotong tidak menyembunyikan keterputusan tepat di batasnya.

**Kolom tambahan `actor_role_at_action`, `session_id`, `request_id` sengaja TIDAK dimasukkan ke dalam rumus hash** — ADR-04 baris 286 mendefinisikan tepat tujuh komponen (sidik jari sebelumnya, waktu, aktor, aksi, objek, nilai sebelum, nilai sesudah). Menambahkan kolom lain ke rumus berarti mengarang urutan penggabungan baru tanpa otorisasi, yang secara eksplisit dilarang oleh instruksi tugas ini.

## Struktur tabel

Enam tabel fondasi mengikuti ERD `docs/04-TRD.md §3.1` **persis** namanya dan kolomnya (dengan satu penyimpangan yang dicatat di bawah): `organization_unit`, `employee`, `app_user`, `role`, `user_role`, `audit_log`.

Tabel berikut tidak dirinci kolomnya di ERD; desainnya diturunkan dari FRD dan API Contract:

| Tabel | FR/API rujukan | Keputusan desain utama |
|---|---|---|
| `permission` | FR-X-005 | Kode `resource:action` (mis. `evidence:review`), sesuai contoh `GET /auth/me` di `07-API-CONTRACT.md §2.4` |
| `role_permission` | FR-X-005 | Tabel penghubung sederhana, unik pada `(role_id, permission_id)` |
| `delegation` | FR-X-007 | Kolom persis seperti diminta tugas (`to_user_id`, `valid_from`, `valid_until`, `scope`, `reason`) plus `from_user_id` (sisi "memberi" pada ERD). `scope` berupa `text[]` menyamai contoh payload `POST /delegations`. Batas 90 hari ditegakkan lewat `CHECK` di basis data. Aturan "penerima tidak boleh mendelegasikan ulang" (rule 2) dan larangan kombinasi peran (rule 4) **tidak** ditegakkan di basis data — keduanya butuh melihat seluruh grafik delegasi/peran pengguna, bukan satu baris, jadi ditegakkan di lapisan repositori aplikasi |
| `session` | FR-X-002 | Tidak ada di ERD maupun API Contract (API Contract belum mendefinisikan titik akhir sesi — dicatat sebagai kesenjangan di bawah). Sesi harus persisten (bukan JWT semata) karena idle timeout, absolute timeout, dan pengakhiran jarak jauh semua butuh baris yang bisa diperiksa peladen pada setiap permintaan. Menyimpan `refresh_token_hash` (SHA-256, dihitung aplikasi), bukan token mentah |
| `uploaded_file` | FR-X-013 | Status pemindaian (`file_scan_status`) memakai empat nilai persis dari `07-API-CONTRACT.md §3.7`. `detected_mime_type` terpisah dari `declared_mime_type` untuk menegakkan rule 3 (jenis dari *magic number*, bukan ekstensi). Batas ukuran 100 MB per berkas ditegakkan lewat `CHECK`; batas gabungan 500 MB per permintaan bukti adalah pemeriksaan lintas-baris, milik lapisan aplikasi |
| `notification` | FR-X-010, FR-X-011 | Satu baris per (penerima, peristiwa) mewakili kotak masuk dalam-aplikasi (cocok dengan `GET/PATCH /notifications`). Status pengiriman surel dilacak di baris yang sama (`email_status`, `email_attempts`) karena satu peristiwa memicu kedua kanal sekaligus. `code` diperiksa lewat pola `NT-nn`, bukan enum tertutup, karena FR-X-010 rule 1 mengizinkan `COMPLIANCE` menyunting templat — kode baru semestinya tidak menuntut migrasi skema |
| `notification_preference` | FR-X-010 | Satu baris per pengguna; `default_frequency` + `category_overrides` (jsonb). Aturan "kategori eskalasi/tenggat tidak dapat diringkas/dimatikan" ditegakkan di lapisan aplikasi terhadap matriks tetap FR-X-011, bukan di `category_overrides` |

## Penyimpangan dari dokumen (disengaja, dicatat)

| # | Penyimpangan | Alasan |
|---|---|---|
| 1 | `audit_log` memiliki kolom `actor_role_at_action`, `session_id`, `request_id` yang tidak ada di ERD `TRD §3.1` | FR-X-008 rule 1 (FRD, lebih rinci dan normatif — "HARUS") menuntut kolom ini. FRD menang atas ERD sesuai instruksi tugas. **Tindak lanjut:** TRD §3.1 perlu disinkronkan lewat `doc-sync` |
| 2 | Setiap tabel (kecuali `audit_log`, yang sudah punya `occurred_at`) memiliki `created_at`/`updated_at` yang tidak tercantum di ERD | ERD bersifat konseptual, bukan skema fisik lengkap; kolom bukuan waktu ini standar untuk operasional (pengurutan, depurasi, invalidasi cache) dan tidak mengubah semantik bisnis tabel manapun. Risiko rendah, ditambahkan secara sadar |
| 3 | `employee.email` tidak diberi `UNIQUE` | ERD `TRD §3.1` hanya menandai `UK` pada `employee_number`, bukan `email`. Diikuti persis sesuai instruksi "ikuti ERD PERSIS", walau secara logika email semestinya unik. **Perlu keputusan manusia** — lihat di bawah |
| 4 | Ekstensi `unaccent` **tidak** dipasang pada migrasi ini | Instruksi tugas item 7 secara eksplisit merujuk `docs/04-TRD.md` baris 96, yang hanya menyebut `pgvector`, `pg_trgm`, `pgcrypto`, `btree_gin`. `unaccent` menyertai konfigurasi pencarian teks Indonesia (ADR-02, `document_chunk`) yang menjadi bagian migrasi Modul C, belum dibangun di sini |
| 5 | Beberapa aturan bisnis FR (mis. FR-X-006 larangan kombinasi peran, FR-X-007 rule 2 larangan delegasi ulang, batas 500 MB gabungan FR-X-013 rule 2) **tidak** ditegakkan lewat `CHECK`/pemicu basis data | Aturan-aturan ini butuh melihat lebih dari satu baris/tabel (grafik relasi, agregasi lintas permintaan) — sesuai `CLAUDE.md`, penyaringan/penegakan semacam ini adalah tanggung jawab lapisan repositori aplikasi, bukan controller maupun trigger DB yang sulit diuji dan gampang jadi sumber galat tersembunyi |
| 6 | Tidak ada tabel `employee_history` untuk riwayat perubahan atribut karyawan | FR-X-017 rule 3 menuntut ini ("siapa atasan orang ini pada tanggal tersebut"), tapi tugas ini membatasi lingkup tabel yang harus dibuat secara eksplisit dan tidak menyebut `employee_history`. **Bukan diam-diam dilewati** — ditandai di bawah sebagai kesenjangan yang perlu keputusan berikutnya |

## Ekstensi yang dipasang

`pgvector` (nama ekstensi Postgres: `vector`), `pg_trgm`, `pgcrypto`, `btree_gin` — dipasang di migrasi ini walau belum ada pemakainya (tabel `document_chunk` milik Modul C belum dibangun), sesuai instruksi tugas dan `docs/04-TRD.md §1.2` baris 96.

## Pembangkitan primary key (UUID v7)

Kunci utama **dibangkitkan aplikasi**, bukan basis data — tidak ada `DEFAULT` pada kolom `id` bertipe `uuid` di manapun pada migrasi ini, dan skema Prisma sengaja tidak memakai `@default(uuid())` bawaan (itu menghasilkan UUID v4, melanggar konvensi "terurut waktu"). Pemanggil (`apps/api`) bertanggung jawab membangkitkan UUID v7 sebelum memanggil `create()` — paket ini tidak menambahkan dependensi pustaka UUID v7 karena itu di luar cakupan berkas yang diminta (`src/index.ts` hanya mengekspor `PrismaClient` terkonfigurasi).

Pengecualian: `audit_log.id` memakai `bigserial` sesuai `docs/04-TRD.md §3.5` — hanya-tambah, bervolume tinggi, dan urutannya bermakna untuk rantai sidik jari.

## Hal yang perlu diputuskan manusia

1. **Apakah `employee.email` sebaiknya `UNIQUE`?** Diikuti persis sesuai ERD (tidak unik) pada migrasi ini, tapi ini rawan duplikasi data dari umpan HR. Perlu konfirmasi apakah ERD `TRD §3.1` memang bermaksud begitu atau luput dicatat.
2. **Riwayat atribut karyawan (FR-X-017 rule 3) belum dimodelkan.** Perlu tabel `employee_history` (atau pola *slowly changing dimension* serupa) pada migrasi berikutnya — di luar cakupan tugas ini.
3. **Titik akhir sesi (FR-X-002) belum ada di `docs/07-API-CONTRACT.md`.** Tabel `session` dibangun sesuai kebutuhan FRD, tapi API Contract belum mendefinisikan `GET/DELETE /sessions` dsb. — perlu `doc-sync` menambahkannya.
4. **Data acuan (`role`, `permission` baku seperti `SYS_ADMIN`, `COMPLIANCE`, dst.) belum di-*seed*.** Skema ini kosong; pembuatan skrip *seed* sengaja tidak disertakan karena tidak diminta secara eksplisit dan biasanya bukan bagian dari migrasi skema.
5. **Peran `sigap_app` dibuat tanpa kata sandi** oleh migrasi ini secara sengaja. DBA wajib menetapkannya di luar VCS sebelum lingkungan apa pun dianggap siap — lihat "Prasyarat" di atas.

## Aturan migrasi berikutnya

Migrasi lanjutan **harus** aman terhadap versi aplikasi sebelumnya (lihat `CLAUDE.md`/spesifikasi `db-migrator`): tambah kolom sebagai boleh-kosong dulu, isi mundur, baru hapus kolom lama — tidak pernah pada rilis yang sama dengan perubahan aplikasinya. Migrasi yang menyentuh `audit_log`, `session`, `uploaded_file`, `snapshot_line`, atau tabel besar lain yang sudah berisi data produksi **wajib** memakai `CREATE INDEX CONCURRENTLY` (di luar blok transaksi migrasi Prisma — lihat dokumentasi Prisma tentang `migration.sql` non-transaksional bila diperlukan).

---

## Modul B — Access Review (`20260828100000_module_b`)

Sumber kebenaran: [`docs/04-TRD.md §3.3`](../../docs/04-TRD.md) (ERD lengkap untuk `application`, `entitlement_catalog`, `access_snapshot`, `snapshot_line`, `review_campaign`, `review_item`, `review_decision`, `revocation_ticket`, `sod_rule`), [`docs/03-FRD.md` FR-B-001..025](../../docs/03-FRD.md), [`docs/10-TEST-PLAN.md §3.2`](../../docs/10-TEST-PLAN.md) (kontrol kritis K-1, K-2, K-3, K-4, K-9).

### Tabel yang kolomnya tidak dirinci ERD (dirancang sendiri)

| Tabel | FR rujukan | Keputusan desain utama |
|---|---|---|
| `connector` | FR-B-003, ADR-05 | `type` meniru union `AccessConnector.type` (ldap/jdbc/rest/sftp/manual). Kredensial dienkripsi kolom lewat `pgcrypto` (`encrypted_credentials bytea`, ditulis dengan `pgp_sym_encrypt()`), tidak pernah `SELECT` ke DTO generik. **Gap tercatat:** tabel riwayat per-eksekusi (`connector_run`, FR-B-003 rule 3) belum dibuat — di luar daftar 15 tabel yang diminta tugas ini |
| `campaign_scope` | FR-B-008 | Satu baris per aplikasi dalam cakupan kampanye, dengan `scope_filter` (jsonb) menampung filter unit organisasi/jabatan/tingkat risiko/istimewa/kode anomali. `item_count` adalah cache dari pratinjau peluncuran (rule 2), bukan kolom terhitung langsung |
| `campaign_signoff` | FR-B-015, **K-9** | Satu baris per (kampanye, penandatangan, lapis). K-9 diimplementasikan lewat `content_fingerprint` (SHA-256 heksadesimal atas kumpulan keputusan yang ditandatangani, dihitung aplikasi) + `decision_counts` (jsonb). Pembukaan kembali (rule 4) tidak menghapus baris; ia menandai `is_active=false` dan mengisi `reopened_at/reopened_by/reopen_reason` pada baris yang sama — sidik jari asli tetap tersimpan |
| `sod_violation` | FR-B-024 rule 2, AN-08 | Satu baris per (karyawan, hak akses A, hak akses B) yang terdeteksi konflik pada suatu snapshot. Merujuk `entitlement_catalog` langsung (bukan `snapshot_line`) secara sengaja — agar kunci asingnya dapat ditegakkan basis data, tidak terkena batasan tabel terpartisi (lihat di bawah) |
| `sod_exception` | FR-B-025 | Persetujuan direksi untuk risiko kritis (rule 2) **tidak** ditegakkan lewat `CHECK` — perlu melihat peran/senioritas penyetuju, pemeriksaan lintas tabel yang menjadi tanggung jawab lapisan repositori aplikasi |
| `access_anomaly` | FR-B-007 | Satu baris per anomali (AN-01..AN-08) per snapshot. `details` (jsonb) menampung akun/baris terkait untuk anomali yang mencakup banyak baris (mis. AN-06). "Umur sejak pertama terdeteksi" (rule 3) — `first_detected_at` dipertahankan aplikasi lintas snapshot, bukan kunci alami yang ditegakkan basis data |

### Kontrol kritis (docs/10-TEST-PLAN.md §3.2) — cara penegakan & hasil uji

Diuji langsung terhadap basis data pengembangan hidup di porta 5442 (lihat riwayat sesi ini untuk transkrip lengkap; ringkasan di bawah).

| Kontrol | Penegakan | Hasil uji |
|---|---|---|
| **K-1** — `revocation_ticket` tidak dapat ditutup manual | `CHECK chk_revocation_ticket_verified_requires_snapshot`: status `TERVERIFIKASI_TERTUTUP` mewajibkan `verified_by_snapshot_id NOT NULL`. Tidak ada kolom/nilai status lain yang memungkinkan penutupan manual | INSERT/UPDATE ke `TERVERIFIKASI_TERTUTUP` tanpa `verified_by_snapshot_id` **ditolak**; dengan kolom terisi **berhasil**; status lain tanpa kolom terisi **berhasil** (tidak false-positive) |
| **K-2** — tanpa pilihan bawaan | `review_decision.decision` **tanpa** `DEFAULT`; `review_item.status` boleh `DEFAULT 'BELUM_DIPUTUSKAN'` (bukan keputusan) | `INSERT` tanpa kolom `decision` **ditolak** (`NOT NULL` violation, bukan diam-diam terisi nilai bawaan) |
| **K-3** — alasan wajib pada akses istimewa | `CHECK chk_review_decision_reason_format` (panjang ≥10 setelah `btrim`, menolak pengulangan satu karakter via regex ARE `^(.)\1*$`) berlaku untuk **setiap** alasan yang diisi, termasuk `PERTAHANKAN`; `CHECK chk_review_decision_reason_required` mewajibkan alasan untuk `CABUT`/`UBAH`/`ALIHKAN`. Aturan kondisional "wajib walau Pertahankan jika istimewa/berisiko tinggi" (FR-B-012 rule 3) **tidak** ditegakkan di sini — perlu join ke `entitlement_catalog`, jadi jadi tanggung jawab lapisan repositori | Alasan `<10` karakter **ditolak**; alasan berulang (`aaaa...`) **ditolak**; `CABUT` tanpa alasan **ditolak**; `PERTAHANKAN` dengan alasan pendek **ditolak** (format berlaku ke Pertahankan juga); `PERTAHANKAN` tanpa alasan **berhasil**; `CABUT` dengan alasan valid **berhasil** |
| **K-4** — `bulk_applied` tersimpan | Kolom `NOT NULL DEFAULT false` | Diverifikasi: baris yang disisipkan tanpa menyebut `bulk_applied` bernilai `false`, bukan `NULL` |
| **K-9** — sign-off mengunci | `campaign_signoff.content_fingerprint` (`CHECK` format SHA-256 heksadesimal) + `decision_counts` (jsonb); pembukaan kembali menyimpan baris asli (lihat tabel desain di atas) | Sidik jari format salah **ditolak**; sidik jari valid **berhasil** |

### Penyimpangan dari dokumen (disengaja, dicatat)

| # | Penyimpangan | Alasan |
|---|---|---|
| 1 | `snapshot_line` dipartisi berdasarkan `captured_at` (denormalisasi dari `access_snapshot.captured_at`), **bukan** `snapshot_id` seperti tertulis literal di ADR-04 baris 367 | Partisi rentang bulanan atas nilai UUIDv7 `snapshot_id` tidak dapat diekspresikan sebagai `RANGE` partitioning standar PostgreSQL tanpa menghitung batas UUID per bulan secara manual — rapuh dan sulit dibaca. `docs/04-TRD.md §3.5` baris 801 mendeskripsikan keputusan yang sama sebagai "partisi berdasarkan rentang **waktu**", yang merupakan pembacaan literal standar. **Perlu keputusan manusia**: sinkronkan pengkabelan ADR-07 lewat `doc-sync` |
| 2 | Kunci utama `snapshot_line` adalah komposit `(id, captured_at)`, bukan `id` saja seperti tabel lain | Konsekuensi wajib dari partisi PostgreSQL: setiap `UNIQUE`/`PRIMARY KEY` pada tabel terpartisi harus memuat kolom kunci partisi |
| 3 | `review_item.snapshot_line_id`, `access_anomaly.snapshot_line_id` **tidak** memiliki `FOREIGN KEY` ke `snapshot_line` di basis data | Konsekuensi dari #2: PostgreSQL tidak dapat menegakkan `FOREIGN KEY` yang menyasar `id` saja pada tabel terpartisi. Menambah `captured_at` ke tabel-tabel tersebut demi FK komposit ditolak karena berarti menambah kolom di luar daftar kolom ERD `review_item` yang wajib diikuti persis. Integritas referensial ditegakkan di lapisan repositori aplikasi |
| 4 | Banyak `enum` Postgres **dibagi** lintas tabel (`risk_level_type`, `connector_type`, `finding_status`) alih-alih satu `varchar`/`enum` per kolom | Nilai yang sama persis dipakai berulang (mis. tingkat risiko `application`/`entitlement_catalog`/`sod_rule`/`access_anomaly`); berbagi satu tipe mencegah keempatnya berdrift dan menghindari mendefinisikan ulang set tertutup yang sama empat kali |
| 5 | `CHECK`, indeks parsial (`WHERE ...`), fungsi pemicu partisi, dan strategi partisi **tidak** dapat direpresentasikan di `schema.prisma` | Batasan bahasa skema Prisma, sama seperti pengecualian yang sudah didokumentasikan untuk fondasi (`idx_session_idle_expires_at` dst.). `prisma migrate diff` diverifikasi tetap menghasilkan `-- This is an empty migration.` meski kesenjangan ini ada |
| 6 | `application` **tidak** memiliki kolom `uraian`, `jenis data yang diolah`, `metode pengambilan data akses` yang disebut di teks "Atribut" FR-B-001 | ERD `TRD §3.3` (sumber yang diminta diikuti persis untuk tabel ini) tidak mencantumkannya. "Metode pengambilan data akses" direpresentasikan tidak langsung lewat keberadaan baris `connector`. **Perlu keputusan manusia**: apakah ERD perlu diperbarui menambahkan kolom ini |
| 7 | Fungsi manajemen partisi (`ensure_snapshot_line_partition`, `ensure_snapshot_line_partitions_ahead`) memakai `SECURITY DEFINER` | Ditemukan lewat pengujian langsung: `sigap_app` hanya memegang `USAGE` pada skema `public` (bukan `CREATE`), sehingga versi `SECURITY INVOKER` gagal saat dipanggil pekerja terjadwal (`scheduled-jobs`, ADR-08) yang berjalan sebagai `sigap_app`. `SECURITY DEFINER` memberi `sigap_app` kemampuan sempit untuk membuat **hanya** satu bentuk objek (partisi bulanan `snapshot_line` bernama dan berbatas deterministik dari argumen `date`), bukan hak `CREATE` luas pada skema. `search_path` dipatok untuk mencegah eskalasi hak lewat tabel sementara, konsisten dengan pola fungsi `audit_log` di migrasi fondasi |

### Hal yang perlu diputuskan manusia (Modul B)

1. **Kejelasan kata-kata ADR-07** — apakah "berdasarkan `snapshot_id`" pada baris 367 memang salah ketik untuk "berdasarkan waktu", atau ada maksud lain yang belum tertangkap? Migrasi ini mengikuti pembacaan literal §3.5 baris 801 (partisi waktu).
2. **Kolom `application`** — apakah `uraian`, `jenis data yang diolah`, `metode pengambilan data akses` perlu ditambahkan ke ERD dan tabel?
3. **Tabel `connector_run`** — riwayat per-eksekusi konektor (FR-B-003 rule 3) belum dibuat; migrasi Modul B berikutnya perlu menambahkannya.
4. **Rentang bootstrap partisi `snapshot_line`** — migrasi ini membuat partisi untuk tahun kalender berjalan + 3 bulan ke depan (11 partisi pada saat migrasi ditulis, 2026-01 s.d. 2026-11). Pekerjaan terjadwal yang memanggil `ensure_snapshot_line_partitions_ahead()` secara berkala **belum** dikabelkan di `apps/api` — di luar cakupan `packages/db`.
5. **Peran migrasi produksi** — di lingkungan pengembangan ini, migrasi dijalankan sebagai peran superuser `sigap` (bukan `sigap_migrator` khusus seperti disebut di bagian "Prasyarat" fondasi). Fungsi `SECURITY DEFINER` baru (butir 7 di atas) mewarisi hak peran migrasi produksi yang sebenarnya — pastikan peran itu bukan superuser di produksi, agar cakupan hak yang diberikan ke `sigap_app` lewat fungsi ini tetap sempit sesuai maksud.
