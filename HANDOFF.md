# HANDOFF — SIGAP

Status per **28 Agustus 2026**. Untuk orang berikutnya yang melanjutkan, termasuk Anda sendiri beberapa minggu lagi.

---

## 1. Posisi saat ini

**Proyek:** SIGAP — Sistem Integrasi Governance, Akses, dan Prosedur, untuk PT Trimegah Sekuritas Indonesia Tbk.

**Tahap:** dokumentasi lengkap, **fondasi lintas modul sudah berjalan**, Modul B sedang dibangun untuk keperluan demo ke klien.

Ini berubah besar sejak handoff sebelumnya, yang menyatakan "implementasi belum dimulai".

```
docs/          11 dokumen · sumber kebenaran · verify-docs LULUS
apps/api/      NestJS 11 — audit, autentikasi, otorisasi, jejak audit
apps/web/      Next.js 15 — masuk, beranda, jejak audit
packages/db/   Prisma 6 — 2 migrasi, 42 tabel
.claude/       9 subagent + 6 skill
```

**Repo:** `/home/reyfuu/ai-assitant`, cabang `main`, tanpa remote.

### Yang bisa dijalankan hari ini

```bash
pnpm install && cp .env.example .env
pnpm infra:up && pnpm db:setup && pnpm db:generate && pnpm db:seed
pnpm dev:api    # 3001
pnpm dev:web    # 3000
```

Masuk sebagai `bayu.pratama` / `demo`. Rincian pengguna benih ada di [README](README.md).

---

## 2. Modul B: skema sudah ada, kode belum

Migrasi kedua (`20260828100000_module_b`) sudah di-commit dan diterapkan. Lima belas tabel, drift nol, dan kontrol kritisnya **diuji dengan memasukkan data yang seharusnya ditolak** — bukan dibaca dari SQL:

| Kontrol | Bukti |
|---|---|
| K-1 | Tiket ke `TERVERIFIKASI_TERTUTUP` tanpa `verified_by_snapshot_id` ditolak `chk_revocation_ticket_verified_requires_snapshot` |
| K-2 | `review_decision.decision` tanpa `DEFAULT`, `NOT NULL` — keputusan yang tidak diisi gagal, bukan diam-diam jadi "pertahankan" |
| K-3 | Alasan 5 karakter ditolak; `aaaaaaaaaaaaaaa` ditolak; `CABUT` tanpa alasan ditolak |
| K-9 | `campaign_signoff.content_fingerprint` dengan `CHECK` format SHA-256 |

**Belum ada satu baris kode aplikasi untuk Modul B.** Tidak ada repositori, servis, controller, maupun layar. Yang ada baru tempat menyimpan datanya.

### Yang perlu diputuskan sebelum melanjutkan

**Penyimpangan ADR-07 melemahkan integritas referensial.** `snapshot_line` dipartisi atas `captured_at` (didenormalisasi dari `access_snapshot`), bukan `snapshot_id` seperti tertulis di [ADR-07](docs/04-TRD.md) baris 367 — partisi rentang bulanan atas UUID memang tidak bermakna, dan TRD §3.5 sendiri menyebut partisi rentang waktu. Konsekuensinya nyata:

- Kunci utama menjadi komposit `(id, captured_at)`.
- `review_item.snapshot_line_id` dan `access_anomaly.snapshot_line_id` **tidak punya kunci asing** — PostgreSQL tidak dapat mereferensi tabel terpartisi seperti itu.

Artinya integritas referensial untuk dua rujukan itu pindah ke lapisan repositori: dari aturan yang ditegakkan basis data menjadi aturan yang harus dijaga kode. Itu keputusan yang perlu disadari, bukan diwarisi. Perbaiki ADR-07 lewat `doc-sync`, atau ubah rancangannya.

Empat hal lain menunggu jawaban: apakah `application` perlu kolom uraian/jenis data/metode pengambilan sesuai teks FR-B-001 (ERD tidak memuatnya); tabel `connector_run` untuk riwayat eksekusi konektor (FR-B-003 aturan 3) belum dibuat; pekerjaan terjadwal pemanggil `ensure_snapshot_line_partitions_ahead()` belum dikabelkan; dan di produksi peran migrasi **tidak boleh** superuser agar cakupan `SECURITY DEFINER` tetap sempit.

### Temuan ponytail yang belum diterapkan

Model `Connector` (+3 enum, ~45 baris) dan `AccessAnomaly` (+1 enum, ~42 baris) tidak punya kode pemakai dan berada di luar alur demo. Keduanya **tidak** dipotong karena [TRD §3.3](docs/04-TRD.md) menyebut `CONNECTOR` dan `ACCESS_ANOMALY` secara eksplisit di ERD — membuangnya menciptakan penyimpangan dokumen-kode yang justru dilarang CLAUDE.md. Kalau memang ingin dipotong, dokumennya diubah lebih dulu.

Fungsi `ensure_snapshot_line_partitions_ahead` juga masih nol pemanggil sementara 13 partisi sudah dibuat statis.

---

## 3. Sepuluh commit terakhir dan artinya

| Commit | Isi |
|---|---|
| `27bc8ac` | Akar workspace Next dipatok; README diperbaiki karena isinya sudah tidak benar |
| `12433fd` | Layar jejak audit + titik akhir verifikasi rantai |
| `4819212` | Kerangka web: masuk, sesi httpOnly, navigasi menurut hak akses |
| `31c8c01` | Autentikasi, otorisasi, data benih |
| `0175e6d` | Lapisan audit; celah K-7 di sisi aplikasi ditutup |
| `7044466` | Membuat tumpukan benar-benar bisa dijalankan |
| `1a6a2fb` | Fondasi Fase 1: scaffold monorepo + skema jejak audit |

Badan tiap commit memuat alasannya. Baca `git show <sha>` sebelum mengubah apa pun yang disentuhnya — beberapa keputusan tampak aneh sampai Anda tahu serangan apa yang ditutupnya.

---

## 4. Yang menghambat

### 4.1 Kunci API Gemini masih belum dicabut

Terbawa dari handoff sebelumnya dan **belum dikonfirmasi selesai**. Kunci pernah dikirim sebagai teks biasa lewat percakapan. Tidak pernah ditulis ke berkas mana pun, repo dipindai bersih pada setiap commit.

- [ ] Cabut kunci lama di Google AI Studio / Cloud Console
- [ ] Terbitkan kunci baru ke penyimpanan rahasia — bukan `.env`, bukan chat, bukan tiket
- [ ] Catat sebagai pemenuhan **G3** pada [ADR-03](docs/04-TRD.md)

Tidak memblokir pekerjaan apa pun, tapi juga tidak menunggu apa pun.

### 4.2 Brand guideline belum diterima

Token `--tri-*` di [tokens.css](apps/web/src/styles/tokens.css) sengaja dikosongkan, dan sengaja **belum** dimasukkan ke `@theme` — entri `@theme` tanpa nilai membangkitkan kelas utilitas rusak yang merender warna kosong tanpa memberi tanda.

Layar masuk dan bilah atas memakai netral. **Jangan menebak warna merek dari tangkapan layar situs.**

### 4.3 Basis data sistem kemungkinan tercemar

Pada sesi sebelumnya, migrasi kemungkinan mendarat di PostgreSQL sistem di porta 5432, bukan di kontainer. Porta pengembangan sudah dipindah ke 5442/6389/9010 supaya tidak terulang. Pembersihan basis data `sigap` dan peran `sigap_app` di instalasi sistem belum dilakukan.

---

## 5. Hal yang mudah disalahpahami

Ini yang tidak terlihat dari membaca kode saja.

**Migrasi tidak pernah dijalankan sebagai `sigap_app`.** Di PostgreSQL, pemilik objek memegang seluruh *grant option* secara permanen. Kalau `sigap_app` memiliki `audit_log`, ia bisa memberi `DELETE` kembali ke dirinya sendiri, membuang pemicu, lalu mengosongkan tabel — tiga pernyataan, tanpa hak tambahan. Itu bukan teori; review keamanan membuktikannya. Karena itu `audit_log` dimiliki peran `sigap_owner` yang `NOLOGIN`, dan `schema.prisma` punya `directUrl` terpisah. **Jangan pernah memberi `sigap_app` keanggotaan di `sigap_owner`** — satu `GRANT` itu membatalkan seluruh lapisan, dan membatalkannya secara senyap: semua tes tetap lulus.

**Rumus hash memakai pemisah U+001E, dan itu bagian dari kontrol.** Tanpa pemisah, pemberian `SYS_ADMIN` dan pencabutannya menghasilkan sidik jari identik — penukaran `before`/`after` jadi tak terdeteksi. Rumus ini **tidak dapat diubah** setelah ada satu baris produksi.

**`TRUNCATE` bukan `DELETE`.** Ia melewati pemicu tingkat baris. Pemicunya `FOR EACH STATEMENT`, dan `TRUNCATE` disebut eksplisit di `REVOKE`.

**`UnitOfWork.write()` menolak transaksi yang tidak menulis jejak audit.** Lupa mencatat tidak menghasilkan tulisan tanpa jejak — ia menghasilkan tulisan yang gagal. Jangan "memperbaiki" ini dengan membuat pengecualian.

**Penyamaran rahasia berjalan saat masuk, bukan saat tampil.** `audit_log` menolak `UPDATE` dan `DELETE`, jadi rahasia yang masuk ke sana masuk selamanya. Penyamaran yang ditambahkan belakangan tidak bisa menyusul ke belakang.

**Penyedia identitas demo menolak menyala di luar pengembangan.** `NODE_ENV` selain `development`/`test` membuat API gagal start. Skrip `dev:api` menyetelnya eksplisit, bukan membacanya dari `.env` — pemeriksaan keselamatan yang hasilnya bergantung pada urutan pemuatan modul bukan pemeriksaan keselamatan.

**Navigasi yang disaring hak akses bukan kontrol.** FR-X-005 aturan 3 menyatakannya tegas. API menolak permintaan terlepas dari apa yang ditampilkan bilah sisi.

**`prisma migrate dev` menggantung tanpa TTY** dan menahan advisory lock Prisma. Pakai `pnpm db:deploy` di skrip dan CI.

**Aturan lint `consistent-type-imports` dimatikan untuk `apps/api`.** `import type` menghapus metadata `design:paramtypes` yang dipakai NestJS untuk injeksi dependensi, dan kegagalannya muncul saat berjalan, bukan saat kompilasi.

---

## 6. Berikutnya, berurutan

1. **Putuskan penyimpangan ADR-07** (§2). Ia memindahkan integritas referensial dari basis data ke kode; keputusan itu harus sadar sebelum ada kode yang bergantung padanya.
2. **FR-X-003 autentikasi ulang.** Sign-off kampanye (K-9) mensyaratkannya, dan itu bagian dari alur demo. Perlu penyimpanan token berumur pendek — Redis sudah berjalan.
3. **Penyaringan cakupan di lapisan repositori.** Sudah diresolusi di `AuthzService` tapi **belum dipakai menyaring baris mana pun**. Modul B adalah pemakai pertamanya, dan aturan kode #1 menuntutnya ada di repositori, bukan controller.
4. **Backend Modul B:** penyusun kampanye, keputusan reviewer (K-2, K-3, K-4), sign-off (K-9), tiket pencabutan (K-1).
5. **Layar L-10 Review Saya** — layar paling kritis dalam sistem menurut [05-UIUX-FLOW](docs/05-UIUX-FLOW.md). Di sinilah K-2 terlihat sebagai *tidak ada satu pun tombol terpilih saat item ditampilkan*.
6. **Data demo Modul B:** aplikasi Trimegah, katalog hak akses, snapshot, satu kampanye berjalan.

Setelah menyentuh kontrol kritis mana pun: jalankan skill `critical-controls`, lalu subagent `security-reviewer`. Review adversarial pada sesi ini menemukan satu temuan KRITIS dan tiga TINGGI yang semuanya lolos dari daftar periksa.

---

## 7. Utang yang sudah diketahui

Dicatat di badan commit, dikumpulkan di sini supaya tidak hilang.

| Hal | Akibat bila dibiarkan |
|---|---|
| Pemotongan **ekor** rantai audit tidak terdeteksi | ADR-04 menuntut sidik jari kepala rantai disalin ke penyimpanan log di luar basis data. Belum ada. Pihak yang bisa menulis dapat memotong aktivitas terbarunya sendiri |
| Tidak ada penegakan rantai saat `INSERT` | `hash` dan `prev_hash` hanya kolom teks. Baris palsu dapat disisipkan oleh siapa pun yang punya `INSERT` |
| `employee.email` tanpa `UNIQUE` | Mengikuti ERD persis; data HR rawan duplikat |
| `employee_history` belum dimodelkan | FR-X-017 aturan 3 menuntut sistem bisa menjawab "siapa atasan orang ini pada tanggal itu" |
| Titik akhir sesi belum ada di kontrak API | FR-X-002 menjanjikan pengakhiran sesi jarak jauh; [07-API-CONTRACT](docs/07-API-CONTRACT.md) belum memuatnya |
| Satu token buram, bukan JWT + refresh | Menyimpang dari [07-API-CONTRACT §2.1](docs/07-API-CONTRACT.md). Alasannya di badan `31c8c01`. Perlu `doc-sync` |
| Kolom tambahan `audit_log` belum masuk TRD | `actor_role_at_action`, `session_id`, `request_id` dituntut FR-X-008 tapi tidak ada di ERD TRD §3.1. Perlu `doc-sync` |
| Aturan ADR-03 di ESLint mudah dilewati | Tidak menangkap `import()` dinamis, `require()`, maupun `fetch` langsung. Penegakan sebenarnya tetap di jaringan (TRD §5.1) |
| Kata sandi bawaan `docker-compose` memakai `:-` | `.env` yang hilang menghasilkan tumpukan yang berjalan mulus dengan kredensial tertulis di git |

---

## 8. Verifikasi keadaan sehat

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm verify:docs
```

Keempatnya harus lulus. `verify:docs` menggagalkan build bila keterlacakan ID lintas dokumen putus — dokumen adalah sumber kebenaran, dan itu ditegakkan, bukan diimbau.
