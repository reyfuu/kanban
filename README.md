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
| Modul C · Policy Hub | FR-C-* | **Belum** — sisa Fase 1 |
| Modul B · Item review & keputusan | FR-B-011 s.d. FR-B-013 | Jalan — K-2, K-3, K-4 |
| Modul B · Sign-off kampanye | FR-B-015 | Jalan — K-9, dengan sidik jari isi |
| Modul B · Pemantauan kampanye | FR-B-016 | Jalan |
| Modul B · Tiket pencabutan & verifikasi | FR-B-018 s.d. FR-B-021 | Jalan — K-1 |
| Modul B · Penyusun kampanye | FR-B-008 s.d. FR-B-010 | Jalan — susun, pratinjau, luncurkan, perpanjang, batalkan |
| Modul B · Penugasan reviewer | FR-B-009 | Jalan — RA-01, RA-02, RA-03, RA-05; RA-04 belum didukung |
| Modul B · Registri aplikasi | FR-B-001 | Baca saja; pengelolaannya **belum** |
| Modul B · Unggahan data akses & snapshot | FR-B-004 s.d. FR-B-006 | Jalan lewat API — templat, validasi, snapshot, perbandingan, pemetaan akun |
| Modul B · Konektor otomatis | FR-B-003 | Skema saja; belum ada layar unggahan |
| Modul B · Deteksi anomali & SoD | FR-B-007, FR-B-024 | Skema saja; temuan demo dari benih |
| Modul B · Paket bukti kampanye | FR-B-022, FR-B-023 | **Belum** |
| Modul A · Evidence Vault | FR-A-* | **Belum** — Fase 2 |

Layar yang sudah ada: masuk, beranda, jejak audit, **L-09 Penyusun Kampanye**,
**L-10 Review Saya** (termasuk dialog sign-off L-11), daftar kampanye, registri
aplikasi, dan tiket pencabutan. Sembilan pengguna benih dengan peran berbeda
tersedia untuk mencoba.

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

Lalu, masing-masing di terminal sendiri:

```bash
pnpm dev:api              # http://localhost:3001
pnpm dev:web              # http://localhost:3000
pnpm dev:worker           # proses pekerja; belum mengonsumsi antrean apa pun
```

Menghentikan: `Ctrl-C` di tiap terminal, lalu `pnpm infra:down`
(tambahkan `-v` lewat `docker compose down -v` bila ingin membuang datanya).

### Masuk

Kata sandi seluruh pengguna benih: `demo` (ubah lewat `SEED_IDENTITY_PASSWORD`).

| Nama pengguna | Peran | Yang terlihat baginya |
|---|---|---|
| `bayu.pratama` | AUDIT_LEAD | Kampanye, Review Saya, Jejak Audit |
| `rina.kusuma` | SEC_OFFICER | Kampanye, Review Saya, Tiket, Registri Aplikasi |
| `agus.santoso` | APP_OWNER, LINE_MANAGER | Kampanye, Review Saya, Tiket, Registri |
| `hendra.wijaya` | COMPLIANCE | Kampanye, Review Saya, Jejak Audit, Registri |
| `direktur.utama` | EXECUTIVE | Kampanye |
| `admin.sigap` | SYS_ADMIN | Registri Aplikasi saja |

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

## Tata letak

```
apps/api/       NestJS 11 — dua entrypoint dari satu basis kode (ADR-08)
apps/web/       Next.js 15 + Tailwind v4
packages/db/    Prisma 6, skema dan migrasi
docs/           sumber kebenaran
.claude/        harness pengembangan: 9 subagent, 6 skill
```
