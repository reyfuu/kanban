# SIGAP — Panduan Kerja untuk Claude Code

Sistem Integrasi Governance, Akses, dan Prosedur. Platform tata kelola internal untuk perusahaan efek: manajemen bukti audit, review hak akses lintas aplikasi, dan pencarian SOP.

## Aturan paling penting

**Dokumen di `docs/` adalah sumber kebenaran.** Kode mengikuti dokumen, bukan sebaliknya. Bila kode dan dokumen berbeda, salah satunya harus diperbaiki secara sadar — bukan dibiarkan.

**Jangan menulis kode tanpa ID requirement.** Setiap perubahan fungsional harus dapat ditunjuk ke `FR-<X|A|B|C>-nnn` di [docs/03-FRD.md](docs/03-FRD.md). Bila belum ada requirement-nya, pakai skill `add-requirement` dulu.

**Sepuluh kontrol kritis tidak boleh dilemahkan.** Lihat [docs/10-TEST-PLAN.md §3.2](docs/10-TEST-PLAN.md). Perubahan yang menyentuhnya wajib lewat `security-reviewer` sebelum dianggap selesai.

## Peta dokumen

| Perlu tahu | Baca |
|---|---|
| Mengapa sistem ini ada, sasaran & KPI | [01-BRD](docs/01-BRD.md) |
| Untuk siapa, user story | [02-PRD](docs/02-PRD.md) |
| Apa yang harus dibangun — 85 requirement | [03-FRD](docs/03-FRD.md) |
| Arsitektur, ADR, model data, NFR | [04-TRD](docs/04-TRD.md) |
| Alur & layar | [05-UIUX-FLOW](docs/05-UIUX-FLOW.md) |
| Token desain & komponen | [06-DESIGN](docs/06-DESIGN.md) |
| Kontrak REST, 189 titik akhir | [07-API-CONTRACT](docs/07-API-CONTRACT.md) |
| Enam agent AI produk | [08-AGENT-SPEC](docs/08-AGENT-SPEC.md) |
| 33 guardrail agent | [09-GUARDRAILS](docs/09-GUARDRAILS.md) |
| Strategi uji & eval | [10-TEST-PLAN](docs/10-TEST-PLAN.md) |
| Indeks, glosarium, matriks keterlacakan | [00-README](docs/00-README.md) |

## Keputusan arsitektur yang mengikat

Rinciannya di [04-TRD §2](docs/04-TRD.md). Yang sering dilanggar tanpa sadar:

- **ADR-01** — modular monolith NestJS. Modul tidak boleh saling impor kecuali lewat berkas antarmuka publik tiap modul.
- **ADR-02** — pencarian hibrida di dalam PostgreSQL. Jangan menambahkan Elasticsearch/OpenSearch.
- **ADR-03** — seluruh panggilan ke penyedia bahasa eksternal lewat satu LLM Gateway. Tidak ada jalur lain. Embedding selalu lokal.
- **ADR-04** — `audit_log` hanya-tambah, berantai hash. Akun basis data aplikasi tidak punya hak `UPDATE`/`DELETE` di tabel itu.
- **ADR-05** — konektor selalu hanya-baca, kredensial di penyimpanan rahasia.

## Aturan kode yang tidak bisa ditawar

1. **Penyaringan hak akses di lapisan repositori**, bukan di controller. Controller yang menyaring akan terlewat pada jalur pemanggilan lain.
2. **Setiap operasi tulis menulis jejak audit dalam transaksi yang sama.** Gagal menulis jejak audit membatalkan transaksi bisnis.
3. **`404`, bukan `403`,** untuk objek yang keberadaannya sendiri rahasia. `403` mengonfirmasi objek itu ada.
4. **Komponen keputusan tidak menerima properti nilai bawaan.** Penegakan U4 di tingkat kode — lihat [06-DESIGN §9.2](docs/06-DESIGN.md).
5. **Tidak ada tool tulis untuk agent AI.** Lihat [GR-0.1](docs/09-GUARDRAILS.md). Agent menghasilkan `agent_proposal`, manusia yang menulis.
6. **Warna semantik hanya lewat token**, tidak pernah nilai heksadesimal langsung.
7. **Format tanggal dan angka hanya lewat `lib/format`.**

## Tumpukan teknologi

Node 22 · NestJS 11 · Prisma 6 · PostgreSQL 16 (+pgvector, pg_trgm, pgcrypto) · Next.js 15 · React 19 · Tailwind + Radix + TanStack Table · Redis + BullMQ · MinIO · Vitest · Playwright · k6

Seluruhnya berjalan on-premise. Tidak ada layanan awan kecuali penyedia LLM lewat gateway.

## Bahasa

Dokumen, antarmuka pengguna, dan pesan kesalahan dalam **Bahasa Indonesia**. Kode, nama variabel, komentar teknis, dan pesan commit dalam **bahasa Inggris**. Istilah baku antarmuka ada di [06-DESIGN §7.2](docs/06-DESIGN.md) — jangan menciptakan sinonim baru.

## Subagent yang tersedia

| Subagent | Kapan dipakai |
|---|---|
| `spec-guardian` | Sebelum mulai kerja: pastikan lingkupnya benar dan ID requirement-nya jelas |
| `backend-impl` | Implementasi modul NestJS |
| `frontend-impl` | Implementasi layar Next.js |
| `db-migrator` | Skema Prisma & migrasi |
| `agent-builder` | Implementasi agent AI produk AG-1..AG-6 |
| `test-writer` | Penulisan tes terpetakan ke FR/TC |
| `security-reviewer` | Setelah perubahan menyentuh kontrol kritis |
| `eval-runner` | Harness eval AI |
| `doc-sync` | Menjaga dokumen dan kode selaras |

## Skill yang tersedia

`verify-docs` · `add-requirement` · `critical-controls` · `guardrail-audit` · `scaffold-agent` · `run-eval`

## Sebelum menganggap pekerjaan selesai

- [ ] Perubahan dapat ditunjuk ke ID requirement
- [ ] Tes ada dan lulus
- [ ] `critical-controls` dijalankan bila menyentuh K-1..K-10
- [ ] `guardrail-audit` dijalankan bila menyentuh agent AI
- [ ] `verify-docs` lulus bila dokumen ikut berubah
