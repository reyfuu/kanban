# SIGAP

Sistem Integrasi Governance, Akses, dan Prosedur — platform tata kelola internal
PT Trimegah Sekuritas Indonesia Tbk.

Dokumen di [`docs/`](docs/) adalah sumber kebenaran; kode mengikutinya. Aturan
kerja ada di [`CLAUDE.md`](CLAUDE.md), keadaan proyek di [`HANDOFF.md`](HANDOFF.md).

## Tahap saat ini

Roadmap ada di [BRD §11](docs/01-BRD.md): **Fase 1** Fondasi & Policy Hub · **Fase 2** Evidence Vault · **Fase 3** Access Review.

Yang dikerjakan sekarang adalah **fondasi lintas modul (FR-X) dari Fase 1**, lalu melompat ke **Modul B** lebih awal karena itu yang dipilih sebagai cerita demo ke klien.

| Kemampuan | Requirement | Keadaan |
|---|---|---|
| Autentikasi lewat antarmuka `IdentityProvider` | FR-X-001 | Penyedia demo jalan; implementasi LDAPS **belum** |
| Sesi persisten, idle 30 menit, absolut 12 jam | FR-X-002 | Jalan; peringatan 2 menit di antarmuka belum |
| Autentikasi ulang aksi sensitif | FR-X-003 | Jalan — token 5 menit di Redis, terikat sesi; dipakai sign-off (K-9) |
| Peran, hak akses, cakupan | FR-X-005 | Jalan; penyaringan cakupan ditegakkan di lapisan repositori Modul B |
| Pemisahan tugas internal | FR-X-006 | **Belum** |
| Pendelegasian wewenang | FR-X-007 | Ditampilkan; pembuatannya **belum** |
| Jejak audit berantai + verifikasi | FR-X-008 | Jalan, termasuk penyamaran rahasia |
| Riwayat objek | FR-X-009 | **Belum** |
| Notifikasi | FR-X-010, FR-X-011 | **Belum** |
| Unggahan berkas & pemindaian | FR-X-013 | Skema saja |
| Modul C · Jenis, taksonomi, siklus hidup dokumen | FR-C-001 s.d. FR-C-004 | Jalan — mesin status penuh; supersesi tanpa jeda dijaga indeks unik parsial |
| Modul C · Versi, perbandingan & jendela berlaku | FR-C-006, FR-C-007 | Jalan — mayor.minor, perbandingan isi antar versi, dan "versi mana yang berlaku pada tanggal X" |
| Modul C · Tinjauan berkala | FR-C-008 | Jalan — pernyataan tetap berlaku + daftar terlambat ditinjau (tidak pernah mencabut otomatis) |
| Modul C · Pencarian hibrida & hak akses | FR-C-009 s.d. FR-C-012 | Jalan — RRF di dalam PostgreSQL, penyaringan hak akses sebelum pemeringkatan, penyaring berhitung, pencarian nihil tercatat |
| Modul C · Penautan dokumen ke kontrol | FR-C-022 | Jalan lewat API |
| Modul C · Alur persetujuan berjenjang | FR-C-005 | Jalan — telaah paralel, pengesahan berurutan, autentikasi ulang, pengalihan ke delegasi/atasan |
| Modul C · Jawaban berbasis dokumen + gerbang klasifikasi | FR-C-013 s.d. FR-C-018 | **Belum** — seluruhnya lewat LLM Gateway (ADR-03) |
| Modul C · Kampanye attestation | FR-C-019 s.d. FR-C-021 | Jalan — kriteria sasaran, gerbang baca ditegakkan server, pernyataan tak dapat dibatalkan (grant basis data), pemantauan per unit & jabatan, laporan menjadi bukti Modul A |
| Modul B · Item review & keputusan | FR-B-011 s.d. FR-B-013 | Jalan — K-2, K-3, K-4 |
| Modul B · Sign-off kampanye | FR-B-015 | Jalan — K-9, dengan sidik jari isi |
| Modul B · Pemantauan kampanye | FR-B-016 | Jalan |
| Modul B · Tiket pencabutan & verifikasi | FR-B-018 s.d. FR-B-021 | Jalan — K-1 |
| Modul B · Penyusun kampanye | FR-B-008 s.d. FR-B-010 | Jalan — susun, pratinjau, luncurkan, perpanjang, batalkan |
| Modul B · Penugasan reviewer | FR-B-009 | Jalan — RA-01, RA-02, RA-03, RA-05; RA-04 belum didukung |
| Modul B · Registri aplikasi | FR-B-001 | Baca saja; pengelolaannya **belum** |
| Modul B · Unggahan data akses & snapshot | FR-B-004 s.d. FR-B-006 | Jalan lewat API — templat, validasi, snapshot, perbandingan, pemetaan akun |
| Modul B · Konektor otomatis | FR-B-003 | Skema saja; belum ada layar unggahan |
| Modul B · Deteksi anomali & SoD | FR-B-007, FR-B-024, FR-B-025 | Jalan lewat API — mesin deteksi berjalan saat snapshot mendarat |
| Modul B · Paket bukti kampanye | FR-B-022, FR-B-023 | Jalan lewat API — paket delapan bagian, sidik jari sendiri, otomatis jadi bukti Modul A dan menutup kampanye |
| Modul A · Evidence Vault | FR-A-001 s.d. FR-A-018 | Jalan lewat API — pustaka kontrol, penugasan, bukti (K-8), retensi, temuan, portal auditor eksternal |

Layar yang sudah ada: masuk, beranda, jejak audit, **L-09 Penyusun Kampanye**,
**L-10 Review Saya** (termasuk dialog sign-off L-11), daftar kampanye, registri
aplikasi, tiket pencabutan, **Pusat Kebijakan** (pencarian + detail dokumen
beserta alur persetujuan dan perbandingan versi), dan **Pernyataan Saya**. Sembilan pengguna benih dengan peran berbeda tersedia untuk mencoba.

### Alur demo Modul B

Masuk sebagai `dewi.lestari` (pemilik Back Office & Trading) lalu buka **Review Saya**:

1. Delapan item. Tidak satu pun tombol keputusan terpilih — itu K-2, dan
   terlihat langsung di HTML yang dirender.
2. Item istimewa dan berkonflik tampil sebagai kartu penuh; item rutin sebagai
   baris ringkas yang dapat dipilih massal. Item berisiko tidak punya kotak
   centang sama sekali (K-4).
3. Rudi Hartono memegang "Order Entry" sekaligus "Settlement Approver" —
   konflik SOD-01, dijelaskan sebagai kalimat risiko bisnis, bukan kode aturan.
4. Keputusan **Pertahankan** pada hak akses istimewa tetap menuntut alasan, dan
   labelnya menyebut alasannya: "wajib — hak akses istimewa" (K-3).
5. Setelah seluruh item diputuskan, **Tanda tangani hasil review** meminta kata
   sandi kembali (FR-X-003), menampilkan ringkasan jumlah keputusan sebelum
   ditandatangani, lalu mengunci seluruh keputusan (K-9).
6. Keputusan "Cabut" menghasilkan tiket pencabutan. Masuk sebagai
   `rina.kusuma` (SEC_OFFICER) untuk melihatnya di **Tiket Pencabutan** — dan
   untuk membuktikan K-1: tiket **tidak dapat** ditutup dengan menyatakan
   pekerjaan selesai. Hanya snapshot baru yang membuktikan akses telah hilang
   dapat menutupnya; bila akses masih ada, tiket menjadi Gagal Diverifikasi.

### Menutup lingkaran K-1 dengan data akses sungguhan

Sampai sesi ini, satu-satunya sumber data akses adalah benih, jadi langkah 6 di
atas berhenti pada "tiket menunggu snapshot berikutnya". Snapshot itu kini dapat
dimasukkan. Belum ada layarnya — alurnya lewat API, sebagai `rina.kusuma`
(hanya `SEC_OFFICER` yang memegang `snapshot:upload`):

```bash
T=$(curl -s -X POST localhost:3001/api/v1/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"username":"rina.kusuma","password":"demo"}' \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')
APP=$(curl -s localhost:3001/api/v1/applications -H "Authorization: Bearer $T" \
    | python3 -c 'import sys,json;print(next(a["id"] for a in json.load(sys.stdin)["data"] if a["code"]=="BACKOFFICE"))')

# 1. Templat berisi kode hak akses aplikasi ini, bukan contoh karangan.
curl -s "localhost:3001/api/v1/applications/$APP/upload-template" -H "Authorization: Bearer $T"

# 2. Validasi menulis nol baris dan melaporkan seluruh masalah sekaligus.
curl -s -X POST localhost:3001/api/v1/snapshots/upload/validate \
  -H "Authorization: Bearer $T" -F "application_id=$APP" -F "file=@akses.csv"

# 3. Simpan. Verifikasi pencabutan berjalan atas snapshot ini juga.
curl -s -X POST localhost:3001/api/v1/snapshots/upload -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"validation_id":"...","skip_invalid_rows":true}'
```

Yang layak ditunjukkan pada demo:

- Validasi memeriksa **seluruh** baris, bukan berhenti pada yang pertama, dan
  mengembalikan berkas berisi baris bermasalah beserta alasannya.
- Buang lebih dari 30% baris dari berkasnya dan penyimpanan **ditolak** sampai
  penurunan itu dikonfirmasi dengan alasan tertulis — alasan itu masuk ke jejak
  audit bersama nama pengunggah dan sidik jari isi berkas (FR-B-004 aturan 6).
- Hilangkan hak akses yang tiketnya sedang menunggu, lalu simpan: tiket menutup
  sendiri dan menyebut snapshot yang membuktikannya. Biarkan hak aksesnya, dan
  tiket menjadi **Gagal Diverifikasi**. Tidak ada tombol yang mengubah keduanya.
- `GET /snapshots/compare?from=…&to=…` menunjukkan apa yang bertambah,
  berkurang, dan berubah statusnya di antara dua pengambilan data.

Untuk menyusun kampanye sendiri, masuk sebagai `rina.kusuma` lalu
**Kampanye → Susun kampanye**. Wisaya empat langkahnya berakhir pada pratinjau
yang menghitung jumlah item, jumlah reviewer, dan sebaran bebannya sebelum
apa pun diarahkan ke siapa pun — dan menonaktifkan tombol peluncuran selama
masih ada snapshot yang lebih tua dari tujuh hari.

### Alur demo Modul C

Benihnya memuat empat dokumen normatif, dibentuk untuk menunjukkan hal yang
sulit dipercaya kalau hanya dibaca di dokumen.

1. Masuk sebagai `hendra.wijaya` (COMPLIANCE), buka **Pusat Kebijakan**, cari
   `penyelesaian transaksi`. Hasilnya menunjuk **pasal**, bukan sekadar dokumen:
   "Bab II PELAKSANAAN · Pasal 3". Itu yang membuat rujukan jawaban dapat
   diperiksa.
2. Buka **SOP Penyelesaian Transaksi Efek**. Riwayat versinya memperlihatkan
   versi 1.0 berstatus Digantikan dengan jendela berlaku yang **tertutup pada
   hari sebelum** versi 2.0 mulai berlaku. Tidak ada satu hari pun tanpa aturan.
3. Masuk sebagai `fajar.nugroho` (Kepala Cabang, unit RTL) dan cari
   `aksi korporasi`. Nol hasil, nol saran, dan **jumlah pada penyaring "Kebijakan"
   ikut berkurang satu**. Dokumen RAHASIA milik Direksi itu tidak bocor lewat
   celah mana pun — bandingkan dengan `direktur.utama`, yang melihatnya.
4. Masih sebagai `fajar.nugroho`, cari `hak akses`: nol hasil. Masuk sebagai
   `bayu.pratama` (SKAI): dokumen TERBATAS itu muncul, karena unit SKAI diberi
   akses eksplisit.
5. Buka **Pedoman Pengelolaan Hak Akses Aplikasi**. Dokumen ini sengaja
   **terlambat ditinjau** dan tetap ditandai berlaku. SIGAP tidak pernah
   mencabut prosedur otomatis karena keterlambatan administrasi; kekosongan
   aturan lebih berbahaya daripada dokumen yang agak kedaluwarsa.
6. Susun dokumen baru sebagai `hendra.wijaya`, ajukan ke alur, lalu setujui
   sebagai `sari.dewi` (penelaah) dan sahkan sebagai `hendra.wijaya` (pengesah
   SOP). Dua hal yang perlu diperhatikan: **status dokumen tidak dapat dinaikkan
   langsung** — mencoba memindahkannya ke Disahkan ditolak, karena satu-satunya
   jalan menuju Disahkan adalah lewat tanda tangan; dan **setiap keputusan
   menuntut autentikasi ulang** (FR-X-003). Jejak auditnya menjadi rangkaian
   `BUAT_DOKUMEN → AJUKAN_TELAAH_DOKUMEN → SETUJUI_TELAAH_DOKUMEN →
   SAHKAN_DOKUMEN → BERLAKUKAN_DOKUMEN`, dan seluruh langkahnya tampil pada
   halaman detail dokumen.
7. Pada **SOP Penyelesaian Transaksi Efek**, klik **Bandingkan versi 1.0 dengan
   2.0**. Perbedaannya ditampilkan baris demi baris, dan perubahan itu ditandai
   **substansial** — angkanya diletakkan di depan pengesah justru untuk menangkap
   penulisan ulang yang diajukan sebagai perubahan minor demi melewati sebagian
   jenjang pengesahan. Penandaan itu memberi tahu, tidak pernah memblokir:
   substansi versus redaksional adalah penilaian atas makna, dan tidak ada
   hitungan baris yang bisa memutuskannya.
8. Sebagai `hendra.wijaya`, buat kampanye attestation atas sebuah kebijakan lalu
   luncurkan. Masuk sebagai `sari.dewi`, buka **Pernyataan Saya**, dan coba
   menyatakan telah membaca: tombolnya tidak aktif sampai dokumen benar-benar
   dibuka beberapa detik dan digulir sampai akhir. Gerbang itu **bukan** kendali
   sesungguhnya — siapa pun bisa memanggil titik akhirnya langsung — jadi server
   menegakkan batas bawahnya sendiri dan menyimpan apa yang dilihatnya. Progres
   kampanye dihitung dari kewajiban, bukan dari pernyataan, sehingga 1 dari 398
   terbaca **1%** dan bukan 0%, dan 397 dari 398 terbaca 99% dan bukan 100%:
   angka kepatuhan yang membulatkan kewajiban tertunggak menjadi hilang lebih
   berbahaya daripada angka yang kurang presisi.

Yang membuat butir 3 dan 4 dapat dipercaya: penyaringan hak akses berupa fungsi
`check_document_access` di dalam PostgreSQL, dan **setiap** cabang kueri
pencarian wajib mem-`JOIN` CTE yang memanggilnya. Penyaring di lapisan aplikasi
bisa terlewat oleh satu jalur kueri; penyaring ini tidak bisa.

## Menjalankan

Prasyarat: Node 22, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env      # nilai bawaannya sudah cocok untuk pengembangan lokal
pnpm infra:up             # PostgreSQL 16, Redis 7, MinIO
pnpm db:setup             # terapkan migrasi + kata sandi peran aplikasi (dev)
pnpm db:generate          # bangkitkan Prisma Client
pnpm db:seed              # data benih: peran, hak akses, sembilan pengguna
```

Lalu nyalakan aplikasinya. Cara yang disarankan adalah lewat pengelola proses,
yang menjaga tepat satu instance tiap layanan dan membatasi memori Node — mesin
pengembangan dengan RAM terbatas gampang kehabisan memori bila tiga proses
`--watch` berjalan berlipat:

```bash
pnpm dev                  # nyalakan api + worker + web sekaligus
pnpm dev:status           # tabel status: hidup/mati, porta, dan pemakaian RAM
pnpm dev:logs web         # ikuti log satu layanan
pnpm dev:restart api      # restart satu layanan
pnpm dev:down             # matikan semuanya
```

Buka <http://localhost:3000>, masuk sebagai salah satu pengguna di tabel di
bawah dengan kata sandi `demo`.

Bila lebih suka satu terminal per layanan, tiga perintah ini setara:

```bash
pnpm dev:api              # http://localhost:3001
pnpm dev:web              # http://localhost:3000
pnpm dev:worker           # proses pekerja; belum mengonsumsi antrean apa pun
```

Kompilasi pengembangan memakai **SWC**, bukan `tsc`. Mode watch `tsc` menahan
seluruh program TypeScript di memori dan sendirian memakai sekitar 486MB; SWC
mengompilasi per berkas, sehingga total proses API turun dari ~712MB ke ~320MB
tanpa satu baris kode aplikasi berubah. Build produksi (`pnpm build`) tetap
memakai `tsc`, sehingga pemeriksaan tipe pada artefak yang dikirim tidak
berkurang.

Runtime yang lebih ringan (Bun, atau `tsx`/esbuild) **tidak bisa dipakai** di
sini, dan itu sudah diuji, bukan diasumsikan: NestJS bergantung pada
`emitDecoratorMetadata` untuk injeksi dependensinya, sedangkan esbuild — mesin
di balik tsx maupun Bun — tidak memancarkannya. Aplikasinya memang menyala dan
seluruh 192 rutenya termuat di Bun, tetapi setiap controller melempar
`Cannot read properties of undefined` begitu dipanggil, karena
`design:paramtypes` tidak pernah ada. SWC memancarkannya, jadi ia satu-satunya
jalur cepat yang benar untuk basis kode berdekorator.

Menghentikan: `pnpm dev:down` (atau `Ctrl-C` di tiap terminal), lalu
`pnpm infra:down` (tambahkan `-v` lewat `docker compose down -v` bila ingin
membuang datanya).

### Masuk

Kata sandi seluruh pengguna benih: `demo` (ubah lewat `SEED_IDENTITY_PASSWORD`).

| Nama pengguna | Peran | Yang terlihat baginya |
|---|---|---|
| `bayu.pratama` | AUDIT_LEAD, DOC_APPROVER | Kampanye, Review Saya, Jejak Audit, Pusat Kebijakan |
| `rina.kusuma` | SEC_OFFICER | Kampanye, Review Saya, Tiket, Registri Aplikasi |
| `agus.santoso` | APP_OWNER, LINE_MANAGER | Kampanye, Review Saya, Tiket, Registri |
| `hendra.wijaya` | COMPLIANCE, DOC_AUTHOR | Kampanye, Review Saya, Jejak Audit, Registri, Pusat Kebijakan |
| `direktur.utama` | EXECUTIVE | Kampanye |
| `admin.sigap` | SYS_ADMIN | Registri Aplikasi saja |
| `fajar.nugroho` | LINE_MANAGER | Review Saya, Pusat Kebijakan |
| `sari.dewi` | AUDITOR_INT | Kampanye, Review Saya, Pusat Kebijakan (mode audit) |
| `dewi.lestari` | APP_OWNER, LINE_MANAGER | Review Saya, Kampanye, Tiket |

`admin.sigap` sengaja tidak melihat satu pun layar keputusan. [FRD §1.4](docs/03-FRD.md) menyatakan administrator sistem tidak dapat menyetujui bukti, menandatangani review, atau mengesahkan dokumen — dan itu ditegakkan lewat hak akses, bukan lewat menu.

Penyedia identitas demo **menolak menyala di luar pengembangan**. Ia tidak memverifikasi identitas ke direktori mana pun, jadi `NODE_ENV` selain `development`/`test` membuat API gagal start dengan sengaja.

### Porta

Porta pengembangan sengaja dijauhkan dari nilai bawaan, karena tabrakan porta
gagalnya senyap — kontainer menolak mengikat, lalu `DATABASE_URL` diam-diam
menunjuk basis data lain dan migrasi berjalan di tempat yang keliru.

| Layanan | Porta | Diubah lewat |
|---|---|---|
| PostgreSQL | 5442 | `POSTGRES_PORT` |
| Redis | 6389 | `REDIS_PORT` |
| MinIO | 9010 / 9011 | `MINIO_PORT`, `MINIO_CONSOLE_PORT` |
| API | 3001 | `API_PORT` |
| Web | 3000 | `WEB_PORT` |

### Migrasi

`pnpm db:deploy` bersifat non-interaktif dan dipakai di skrip maupun CI.
`pnpm db:migrate` (`prisma migrate dev`) **menggantung tanpa TTY** — pakai hanya
di terminal sungguhan, saat memang perlu membuat migrasi baru.

Keduanya memakai dua peran basis data yang berbeda, dan perbedaan itu adalah
kontrol kritis K-7, bukan kerapian: `DATABASE_URL` untuk runtime, dan
`MIGRATE_DATABASE_URL` untuk migrasi. Alasannya di
[`packages/db/README.md`](packages/db/README.md).

## Gerbang mutu

```bash
pnpm lint                 # termasuk batas modul ADR-01 dan larangan egress ADR-03
pnpm typecheck
pnpm test
pnpm verify:docs          # keterlacakan ID lintas dokumen — wajib lulus
```

### Verifikasi antarmuka di peramban

```bash
pnpm dev                          # api + web harus hidup
python3 scripts/verify-ui.py      # butuh google-chrome + websocket-client
```

Menjalankan 24 pemeriksaan perilaku pada Chrome headless: target sentuh diukur
pada lebar 375px, tabel benar-benar berganti kartu di ponsel dan kembali menjadi
tabel di desktop, hint validasi dihitung ulang saat mengetik, kartu keputusan
berada di atas lipatan, skip-link benar-benar terlihat saat difokus, Escape
menutup navigasi, dan gerbang baca attestation membuka setelah dokumen dibaca.

Terpisah dari `pnpm test` karena butuh kedua layanan hidup. Ada karena
pemeriksaan tingkat markup pernah meloloskan dua cacat nyata: tiga tombol di
bawah 44px, dan skip-link yang memakai kelas Tailwind yang ternyata tidak
menghasilkan CSS apa pun sehingga tetap 1×1 piksel meski difokus — benar di
markup, tak terlihat di layar.

## Tata letak

```
apps/api/       NestJS 11 — dua entrypoint dari satu basis kode (ADR-08)
apps/web/       Next.js 15 + Tailwind v4
packages/db/    Prisma 6, skema dan migrasi
docs/           sumber kebenaran
.claude/        harness pengembangan: 9 subagent, 6 skill
```
