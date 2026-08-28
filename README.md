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
| Autentikasi ulang aksi sensitif | FR-X-003 | **Belum** — diperlukan sebelum sign-off (K-9) |
| Peran, hak akses, cakupan | FR-X-005 | Resolusi jalan; penyaringan cakupan di repositori **belum dipakai** |
| Pemisahan tugas internal | FR-X-006 | **Belum** |
| Pendelegasian wewenang | FR-X-007 | Ditampilkan; pembuatannya **belum** |
| Jejak audit berantai + verifikasi | FR-X-008 | Jalan, termasuk penyamaran rahasia |
| Riwayat objek | FR-X-009 | **Belum** |
| Notifikasi | FR-X-010, FR-X-011 | **Belum** |
| Unggahan berkas & pemindaian | FR-X-013 | Skema saja |
| Modul C · Policy Hub | FR-C-* | **Belum** — sisa Fase 1 |
| Modul B · Access Review | FR-B-* | Sedang dibangun |
| Modul A · Evidence Vault | FR-A-* | **Belum** — Fase 2 |

Layar yang sudah ada: masuk, beranda, dan jejak audit. Sembilan pengguna benih dengan peran berbeda tersedia untuk mencoba.

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
