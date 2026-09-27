# HoyoKanban — Panduan Asisten AI & Pengembangan Sistem

Sistem Kanban & Pelacak Progres Karakter untuk **Genshin Impact** dan **Zenless Zone Zero (ZZZ)**.
Aplikasi web berbasis alur kerja visual untuk mengelola progres build karakter, stamina (Resin/Battery), jadwal rotasi domain harian, dan perencanaan gacha/pity.

---

## 1. Sumber Kebenaran Dokumen

Dokumen di direktori [`docs/`](docs/) adalah sumber kebenaran arsitektur dan fungsional:

| Perlu Tahu | Baca |
|---|---|
| Mengapa sistem ini ada, sasaran & persona pemain | [01-BRD.md](docs/01-BRD.md) |
| Spesifikasi modul & kebutuhan fungsional (FR-KB, FR-CH, FR-MC, FR-ST, dll.) | [02-FRD.md](docs/02-FRD.md) |
| Arsitektur teknis, Next.js Vercel, Go Gin backend, skema data & API | [03-TRD.md](docs/03-TRD.md) |
| Indeks dokumentasi | [docs/README.md](docs/README.md) |

---

## 2. Skill yang Digunakan Proyek

Proyek ini memanfaatkan skill-skill spesialis berikut:

| Skill | Tipe / Lokasi | Fungsi |
|---|---|---|
| ⚡ **`superpower` / `superpowers`** | Skill ([`.claude/skills/superpowers/SKILL.md`](.claude/skills/superpowers/SKILL.md)) | Metodologi rekayasa perangkat lunak disiplin: *Brainstorming* -> *Bite-sized plan* -> *TDD (Red-Green-Refactor)* -> *Two-Stage Review*. Mencegah *vibe coding* dan memastikan kode memiliki unit test. |
| 🕸️ **`graphify`** | Skill (Global) | Pemetaan graf pengetahuan arsitektur: menganalisis relasi antar komponen Next.js, hooks, store, dan API Go; mendeteksi *god-nodes* dan *circular dependencies*. |
| 🎀 **`ponytail`** | Skill (Global) | Filosofi anti-*over-engineering* & radikal YAGNI: memilih solusi paling minimalis, mengutamakan library standar, dan memangkas boilerplate yang tidak perlu. |
| ✂️ **`rtk`** | Tool CLI (`~/.config/rtk`) | Rust Token Killer: menyaring dan meringkas output terminal (test & build) agar hemat token. |
| 🔥 **`grill-me`** | Command / Interview | Wawancara kritis untuk menantang asumsi, menguji kasus batas (*edge cases*), dan mengonfirmasi rancangan sebelum implementasi. |

---

## 3. Subagent Teknis Proyek ([`.claude/agents/`](.claude/agents/))

| Subagent | Berkas | Peran |
|---|---|---|
| `frontend-impl` | [frontend-impl.md](.claude/agents/frontend-impl.md) | Implementasi UI Next.js 15, React 19, `@dnd-kit`, Zustand di `apps/web`. Vercel-ready. |
| `backend-impl` | [backend-impl.md](.claude/agents/backend-impl.md) | Implementasi Go 1.22 + Gin Framework di `apps/api-go` (optimizer rute resin & proxy showcase). |
| `grill-guardian` | [grill-guardian.md](.claude/agents/grill-guardian.md) | Penjaga spesifikasi FRD/TRD dan penantang desain sebelum penulisan kode dimulai. |
| `graphify-mapper` | [graphify-mapper.md](.claude/agents/graphify-mapper.md) | Audit arsitektur dan pemetaan dependensi kode. |

---

## 4. Tumpukan Teknologi

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@dnd-kit/core`, Zustand (Local-First IndexedDB adapter).
- **Hosting Target**: Vercel (Edge / Serverless).
- **Backend Eksperimen**: Go 1.22 + Gin Framework (`apps/api-go`).
- **Penyimpanan**: Browser IndexedDB / LocalStorage dengan ekspor/impor berkas JSON (backup aman).
