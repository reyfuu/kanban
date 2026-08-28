# HANDOFF — SIGAP

Status per **28 Agustus 2026**. Untuk orang berikutnya yang melanjutkan, termasuk Anda sendiri beberapa minggu lagi.

---

## 1. Posisi saat ini

**Proyek:** SIGAP — Sistem Integrasi Governance, Akses, dan Prosedur, untuk PT Trimegah Sekuritas Indonesia Tbk.

**Tahap:** dokumentasi lengkap, fondasi lintas modul berjalan, dan **alur demo Modul B kini utuh dari ujung ke ujung** — reviewer memutuskan, menandatangani, tiket pencabutan terbentuk, dan tiket hanya tertutup oleh bukti snapshot.

```
docs/          11 dokumen · sumber kebenaran · verify-docs LULUS
apps/api/      NestJS 11 — audit, autentikasi, otorisasi, step-up, Modul B
apps/web/      Next.js 15 — masuk, beranda, jejak audit, Review Saya, Tiket
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

Alur demonya ada di [README](README.md#alur-demo-modul-b). Ringkasnya: masuk sebagai
`dewi.lestari`, buka **Review Saya**, putuskan, tanda tangani; lalu masuk sebagai
`rina.kusuma` untuk melihat tiket yang terbentuk dan mencoba menutupnya secara manual.

---

## 2. Yang berubah pada sesi ini

Empat butir pertama dari daftar "berikutnya" di handoff sebelumnya, ditambah dua layar.

| Butir | Keadaan |
|---|---|
| Penyimpangan ADR-07 | **Diputuskan** — dokumennya diperbaiki, kodenya tetap. Lihat §3 |
| FR-X-003 autentikasi ulang | Jalan — `POST /auth/step-up`, token 5 menit di Redis, terikat sesi |
| Penyaringan cakupan di repositori | Jalan — dan sebuah **kebocoran nyata ditemukan serta ditutup**. Lihat §4 |
| Backend Modul B | Keputusan (K-2/K-3/K-4), sign-off (K-9), tiket & verifikasi (K-1) |
| Layar L-10 Review Saya + L-11 sign-off | Jalan |
| Layar Tiket Pencabutan | Jalan — kolom "Bukti" adalah K-1 yang terlihat |
| Data demo Modul B | 4 aplikasi, 8 hak akses, 13 item, satu konflik SoD nyata |

Kontrol kritis diuji dengan **mencoba melanggarnya** terhadap tumpukan yang berjalan,
bukan dengan membaca kode. Rekamannya:

```
K-2  keputusan dihilangkan → 400 · nilai tak dikenal → 400 · tidak ada radio terpilih di HTML
K-3  Pertahankan pada hak istimewa tanpa alasan → 422 · "masih" → 422 · "aaaaaaaaaaaaaaa" → 422
K-4  massal memuat item istimewa → diterapkan 1, ditolak 1, dengan seluruh alasan pengecualian
K-9  sign-off tanpa X-Step-Up-Token → 401 · token palsu → 401 · ubah keputusan setelah tanda tangan → 409
K-1  minta TERVERIFIKASI_TERTUTUP → 400 (DTO menolaknya) · pelaksana klaim selesai + akses masih
     ada pada snapshot → GAGAL_DIVERIFIKASI · akses benar-benar hilang → tertutup, distempel snapshot
```

Gerbang mutu: lint, typecheck, **37 tes**, `verify:docs` — keempatnya lulus.

---

## 3. Penyimpangan ADR-07: diputuskan

Handoff sebelumnya menyerahkan ini sebagai keputusan terbuka. **Keputusannya: kode benar, dokumennya yang salah.**

ADR-07 menuliskan partisi atas `snapshot_id`, sementara TRD §3.5 pada dokumen yang sama
menyebut partisi rentang **waktu**. Partisi rentang bulanan atas UUID tidak bermakna,
dan pertanyaan arsip selalu berbentuk rentang waktu. [ADR-07](docs/04-TRD.md) sudah
diperbaiki untuk menyebut `captured_at`, **dan** untuk menyatakan konsekuensinya
secara eksplisit alih-alih membiarkannya ditemukan sendiri:

`review_item.snapshot_line_id` dan `access_anomaly.snapshot_line_id` tidak punya kunci
asing, dan tidak akan pernah punya. Integritas referensialnya ada di
`ReviewItemRepository.assertSnapshotLineExists`, dipanggil pada jalur tulis. Ada tes
yang **memastikan basis data memang menerima** review_item yatim — bukan bug yang
diakui, melainkan konsekuensi yang dipatok: hari ketika seseorang berhasil menambahkan
kendala itu, tes tersebut gagal dan memberi tahu bahwa pemeriksaan di repositori sudah
tidak diperlukan, alih-alih membiarkannya hidup tanpa alasan.

---

## 4. Kebocoran cakupan yang ditemukan dan ditutup

Layak dibaca sebelum menulis penyaring cakupan berikutnya, karena bentuk kesalahannya akan berulang.

Versi pertama `ReviewItemRepository` menuliskan cakupan sebagai penyaring Prisma:

```ts
{ campaign: { scopes: { some: { applicationId: { in: scope } } } } }
```

Itu **lolos typecheck, lolos lint, dan salah**. Kalimatnya berbunyi "kampanye ini
memuat sedikitnya satu aplikasi yang boleh Anda lihat" — bukan "item ini milik
aplikasi yang boleh Anda lihat". Akibatnya satu kampanye yang menyentuh satu aplikasi
dalam cakupan seseorang membuka **seluruh** item kampanye itu baginya. Terbukti hidup:
`fajar.nugroho` dapat membaca item review milik `dewi.lestari`, HTTP 200.

Sebabnya bukan kecerobohan, dan itulah bagian yang penting. Aplikasi milik sebuah item
hanya dapat dicapai lewat `snapshot_line`, yang tidak punya kunci asing dari
`review_item` sehingga tidak punya relasi Prisma untuk ditelusuri (§3). Penyaring itu
ditulis terhadap apa yang **bisa dijangkau Prisma**, bukan terhadap apa yang
**dimaksud aturannya** — dan pendekatan terdekat yang bisa dijangkau ternyata jauh
lebih longgar.

Sekarang seleksinya SQL mentah (`scopedItemIds`) yang melakukan join sungguhan, dan
setiap pencari melewatinya. Pelajarannya: bila penyaring cakupan tidak dapat dinyatakan
persis dengan alat yang ada, jangan dekati — ganti alatnya.

---

## 5. Yang menghambat

### 5.1 Kunci API Gemini masih belum dicabut

Terbawa dari dua handoff sebelumnya dan **masih belum dikonfirmasi selesai**. Kunci pernah dikirim sebagai teks biasa lewat percakapan. Tidak pernah ditulis ke berkas mana pun, repo dipindai bersih pada setiap commit.

- [ ] Cabut kunci lama di Google AI Studio / Cloud Console
- [ ] Terbitkan kunci baru ke penyimpanan rahasia — bukan `.env`, bukan chat, bukan tiket
- [ ] Catat sebagai pemenuhan **G3** pada [ADR-03](docs/04-TRD.md)

### 5.2 Brand guideline belum diterima

Token `--tri-*` di [tokens.css](apps/web/src/styles/tokens.css) sengaja dikosongkan, dan sengaja **belum** dimasukkan ke `@theme` — entri `@theme` tanpa nilai membangkitkan kelas utilitas rusak yang merender warna kosong tanpa memberi tanda.

Seluruh layar memakai netral. **Jangan menebak warna merek dari tangkapan layar situs.**

### 5.3 Basis data sistem kemungkinan tercemar

Pada sesi lama, migrasi kemungkinan mendarat di PostgreSQL sistem di porta 5432. Porta pengembangan sudah dipindah ke 5442/6389/9010. Pembersihan basis data `sigap` dan peran `sigap_app` di instalasi sistem belum dilakukan.

---

## 6. Hal yang mudah disalahpahami

Ini yang tidak terlihat dari membaca kode saja. Yang baru ada di bagian bawah.

**Migrasi tidak pernah dijalankan sebagai `sigap_app`.** Pemilik objek memegang seluruh *grant option* secara permanen. Kalau `sigap_app` memiliki `audit_log`, ia bisa memberi `DELETE` kembali ke dirinya sendiri, membuang pemicu, lalu mengosongkan tabel — tiga pernyataan, tanpa hak tambahan. **Jangan pernah memberi `sigap_app` keanggotaan di `sigap_owner`** — satu `GRANT` itu membatalkan seluruh lapisan, dan secara senyap: semua tes tetap lulus.

**Rumus hash memakai pemisah U+001E, dan itu bagian dari kontrol.** Tanpa pemisah, pemberian `SYS_ADMIN` dan pencabutannya menghasilkan sidik jari identik. Rumus ini **tidak dapat diubah** setelah ada satu baris produksi. Sidik jari sign-off (K-9) memakai pemisah yang sama, karena alasan yang sama.

**`TRUNCATE` bukan `DELETE`.** Ia melewati pemicu tingkat baris. Pemicunya `FOR EACH STATEMENT`, dan `TRUNCATE` disebut eksplisit di `REVOKE`.

**`UnitOfWork.write()` menolak transaksi yang tidak menulis jejak audit.** Lupa mencatat menghasilkan tulisan yang **gagal**, bukan tulisan tanpa jejak. Jangan "memperbaiki" ini dengan membuat pengecualian. Konsekuensi yang tidak terduga: `verifyAgainstSnapshot` yang tidak menemukan apa pun untuk dikerjakan tetap harus mencatat sesuatu — ia mencatat `VERIFIKASI_PENCABUTAN_NIHIL`, supaya no-op yang sah tidak terlihat seperti jejak audit yang terlupakan.

**Penyamaran rahasia berjalan saat masuk, bukan saat tampil.** `audit_log` menolak `UPDATE` dan `DELETE`, jadi rahasia yang masuk ke sana masuk selamanya.

**Penyedia identitas demo menolak menyala di luar pengembangan.** `NODE_ENV` selain `development`/`test` membuat API gagal start. Skrip `dev:api` menyetelnya eksplisit.

**Navigasi yang disaring hak akses bukan kontrol.** FR-X-005 aturan 3 menyatakannya tegas.

**`prisma migrate dev` menggantung tanpa TTY.** Pakai `pnpm db:deploy` di skrip dan CI.

**Aturan lint `consistent-type-imports` dimatikan untuk `apps/api`.** `import type` menghapus metadata `design:paramtypes` yang dipakai NestJS untuk injeksi dependensi.

### Yang baru dari sesi ini

**K-1 ditegakkan di tiga lapisan, dan itu disengaja.** DTO tidak memuat `TERVERIFIKASI_TERTUTUP` sehingga permintaannya tidak dapat diucapkan; tabel transisi menolaknya sekiranya pemanggil lain muncul; `CHECK` di basis data menuntut `verified_by_snapshot_id`. Titik akhirnya adalah **aksi bernama** (`/claim`, `/complete`, `/exception`) sesuai kontrak, bukan satu bidang `status` — sebuah titik akhir yang tidak punya tempat untuk menuliskan status target tidak perlu memvalidasi apa pun, jadi tidak ada yang bisa salah divalidasi.

**Jumlah pengalihan dihitung dari `audit_log`, bukan dari kolom penghitung.** `audit_log` menolak `UPDATE` dan `DELETE`, jadi pengalihan tidak dapat disembunyikan dengan menulis ulang hitungannya. Kolom penghitung dapat dinolkan oleh siapa pun yang punya `UPDATE` pada `review_item`.

**Item yang barisnya snapshot-nya tidak dapat ditemukan diperlakukan sebagai paling berisiko, bukan paling aman.** Lihat `ItemRiskProfile` di `review-item.repository.ts`: konteks yang hilang tidak boleh menjadi alasan sebuah item menjadi layak disetujui lima puluh sekaligus.

**`seconds_spent` pada keputusan massal dibagi rata, bukan distempel penuh ke tiap baris.** Nilai itu memberi makan pendeteksi persetujuan asal-asalan (FR-B-014); mencatat 180 detik lima puluh kali justru menyembunyikan pola yang hendak ditemukan.

**`packages/db` kini ikut di-typecheck, termasuk `seed/`.** Sebelumnya `tsconfig.json`-nya hanya memuat `src`, sehingga nilai enum yang salah di benih baru ketahuan saat benihnya dijalankan. Gerbangnya langsung menemukan satu kesalahan tipe lama pada `seed.ts` begitu dinyalakan.

**`ScopeFilter` membedakan "tanpa batasan" dari "dibatasi menjadi kosong".** Dimensi yang tidak ada berarti tidak dibatasi — keadaan sah bagi `COMPLIANCE` dan `AUDIT_LEAD`. Larik kosong berarti dibatasi menjadi tidak apa pun, dan harus cocok dengan nol baris. Menyamakan keduanya mengubah cakupan yang menyempit menjadi cakupan yang membuka semuanya.

---

## 7. Berikutnya, berurutan

1. **Penyusun kampanye (FR-B-008 s.d. FR-B-010).** Kampanye demo sekarang datang dari benih. Ini yang membuatnya dapat dibuat pengguna: pratinjau cakupan, aturan penentuan reviewer, peluncuran, perpanjangan, pembatalan.
2. **Snapshot & konektor (FR-B-003 s.d. FR-B-006).** Sekarang snapshot juga dari benih. Verifikasi pencabutan (K-1) sudah siap menerimanya — ia hanya perlu snapshot yang sungguh masuk.
3. **Deteksi anomali dan SoD (FR-B-007, FR-B-024).** Temuan SoD pada demo ditanam. Mesin deteksinya belum ada, padahal `sod_rule.group_a`/`group_b` sudah menyimpan aturannya.
4. **Paket bukti kampanye (FR-B-022, FR-B-023).** Penanda keputusan massal sudah tercatat di jejak audit dan diminta muncul di paket bukti (FR-B-013 aturan 5) — paketnya sendiri belum ada.
5. **Pekerjaan terjadwal.** Dua fungsi menunggu pemanggil: `ensure_snapshot_line_partitions_ahead()` dan `RevocationService.markUnverifiable()` (FR-B-020 aturan 3). Keduanya benar; keduanya belum pernah berjalan.
6. **Modul C · Policy Hub** — sisa Fase 1.

Setelah menyentuh kontrol kritis mana pun: jalankan skill `critical-controls`, lalu subagent `security-reviewer`. Daftar periksa menangkap pelanggaran yang terlihat; review adversarial menangkap yang tersembunyi — kebocoran cakupan di §4 tidak akan tertangkap oleh daftar periksa.

---

## 8. Utang yang sudah diketahui

| Hal | Akibat bila dibiarkan |
|---|---|
| Pemotongan **ekor** rantai audit tidak terdeteksi | ADR-04 menuntut sidik jari kepala rantai disalin ke penyimpanan log di luar basis data. Belum ada |
| Tidak ada penegakan rantai saat `INSERT` | `hash` dan `prev_hash` hanya kolom teks. Baris palsu dapat disisipkan oleh siapa pun yang punya `INSERT` |
| **Pelaksana tiket tidak punya `ticket:execute`** | FR-B-018 aturan 1 mengarahkan tiket ke pemilik teknis aplikasi, tetapi FRD §1.4 hanya memberi `SEC_OFFICER` wewenang melaksanakannya. Pada demo, tiket ditugaskan ke `agus.santoso` yang **tidak dapat** mengerjakannya. Salah satu dari keduanya harus berubah — dan itu keputusan dokumen, bukan keputusan kode |
| **Delegasi dapat memutuskan tetapi tidak dapat menandatangani** | `itemsInSignoffScope` menyaring `reviewer_id = diri sendiri`, sehingga item milik pemberi delegasi tidak masuk cakupan sign-off penerima delegasi. Mungkin memang benar — menandatangani bersifat pribadi — tetapi FR-X-007 tidak menyatakannya |
| **Sign-off dua lapis belum teruji** | `layerNo` diambil dari `Math.max` atas item; reviewer yang memegang item lapis 1 **dan** 2 akan menandatangani seluruhnya sebagai lapis 2. FR-B-017 aturan 3 belum punya data uji |
| **Tiket `UBAH` tidak pernah terverifikasi otomatis** | Hilangnya hak akses bukan bukti bahwa ia *diturunkan*. Skema tidak menyimpan hak akses tujuan, jadi tiket `UBAH` sengaja ditahan alih-alih ditutup dengan bukti yang tidak menjawab pertanyaannya |
| `employee.email` tanpa `UNIQUE` | Mengikuti ERD persis; data HR rawan duplikat |
| `employee_history` belum dimodelkan | FR-X-017 aturan 3 menuntut sistem bisa menjawab "siapa atasan orang ini pada tanggal itu" |
| Titik akhir sesi belum ada di kontrak API | FR-X-002 menjanjikan pengakhiran sesi jarak jauh; [07-API-CONTRACT](docs/07-API-CONTRACT.md) belum memuatnya |
| Satu token buram, bukan JWT + refresh | Menyimpang dari [07-API-CONTRACT §2.1](docs/07-API-CONTRACT.md). Alasannya di badan `31c8c01`. Perlu `doc-sync` |
| Kolom tambahan `audit_log` belum masuk TRD | `actor_role_at_action`, `session_id`, `request_id` dituntut FR-X-008 tapi tidak ada di ERD TRD §3.1 |
| Aturan ADR-03 di ESLint mudah dilewati | Tidak menangkap `import()` dinamis, `require()`, maupun `fetch` langsung |
| Kata sandi bawaan `docker-compose` memakai `:-` | `.env` yang hilang menghasilkan tumpukan yang berjalan mulus dengan kredensial tertulis di git |
| Model `Connector` dan `AccessAnomaly` belum punya kode pemakai | Dipertahankan karena TRD §3.3 menyebutnya eksplisit di ERD. Membuangnya menciptakan penyimpangan dokumen-kode |

---

## 9. Verifikasi keadaan sehat

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm verify:docs
```

Keempatnya harus lulus. `verify:docs` menggagalkan build bila keterlacakan ID lintas
dokumen putus — dokumen adalah sumber kebenaran, dan itu ditegakkan, bukan diimbau.
