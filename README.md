# SIGAP

Sistem Integrasi Governance, Akses, dan Prosedur — platform tata kelola internal
PT Trimegah Sekuritas Indonesia Tbk.

Dokumen di [`docs/`](docs/) adalah sumber kebenaran; kode mengikutinya. Aturan
kerja ada di [`CLAUDE.md`](CLAUDE.md), keadaan proyek di [`HANDOFF.md`](HANDOFF.md).

**Tahap saat ini: fondasi Fase 1.** Skema basis data dan kerangka aplikasi sudah
berdiri. Belum ada layar maupun titik akhir — API sengaja menjawab `404` untuk
setiap rute.

## Menjalankan

Prasyarat: Node 22, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env      # nilai bawaannya sudah cocok untuk pengembangan lokal
pnpm infra:up             # PostgreSQL 16, Redis 7, MinIO
pnpm db:deploy            # terapkan migrasi
pnpm db:generate          # bangkitkan Prisma Client
```

Lalu, masing-masing di terminal sendiri:

```bash
pnpm dev:api              # http://localhost:3001  (404 di semua rute — belum ada controller)
pnpm dev:web              # http://localhost:3000
pnpm dev:worker           # proses pekerja; belum mengonsumsi antrean apa pun
```

Menghentikan: `Ctrl-C` di tiap terminal, lalu `pnpm infra:down`
(tambahkan `-v` lewat `docker compose down -v` bila ingin membuang datanya).

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
