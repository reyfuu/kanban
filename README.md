# HoyoKanban 🎯

> Sistem Kanban Visual & Pelacak Progres Karakter untuk **Genshin Impact** dan **Zenless Zone Zero (ZZZ)**.

HoyoKanban membantu pemain gacha mengelola progres build karakter dari tahap wishlist hingga siap tempur (*combat-ready*), melacak waktu penuh energi (Original Resin & Battery Charge), memantau rotasi domain harian, dan merencanakan tabungan gacha/pity.

---

## 🚀 Fitur Unggulan

- 📋 **Papan Kanban 7 Tahap**: Drag-and-drop kartu karakter (*Wishlist*, *Acquired*, *Leveling*, *Skills*, *Gear/Relics*, *Tuning*, *Combat Ready*).
- 🎮 **Dukungan Multi-Game**: Beralih instan antara katalog karakter **Genshin Impact** dan **Zenless Zone Zero (ZZZ)**.
- ⚡ **Stamina Hub Real-Time**: Timer live regenerasi Original Resin (cap 200, 8 min/resin) dan Battery Charge (cap 240, 6 min/battery) dengan prediksi jam penuh.
- 🧮 **Kalkulator Defisit Material**: Otomatis menghitung selisih kebutuhan Mora/Denny, buku EXP, material boss, dan buku talenta dari level saat ini menuju level target.
- 📅 **Kalender Rotasi Farming**: Pemetaan jadwal domain buku talenta dan material senjata per hari dengan sorotan otomatis untuk karakter yang sedang aktif difarming.
- 💎 **Gacha & Pity Planner**: Pelacak pity 50/50 dan kalkulator konversi Primogem/Polychrome ke jumlah tarikan (*pulls*).
- 💾 **Local-First & Vercel-Ready**: Berjalan 100% di browser tanpa database berbayar dengan fitur ekspor/impor JSON, siap di-deploy ke Vercel secara gratis.
- 🧪 **Backend Eksperimen Go (Gin)**: Microservice performa tinggi untuk optimasi alokasi farming mingguan dan integrasi showcase UID.

---

## 📚 Dokumentasi Spesifikasi

Dokumentasi lengkap sistem tersedia di direktori [`docs/`](docs/):

- 📄 [**01-BRD.md**](docs/01-BRD.md) — *Business Requirements Document*: Latar belakang, sasaran, persona, dan cakupan.
- 📋 [**02-FRD.md**](docs/02-FRD.md) — *Functional Requirements Document*: Spesifikasi 8 modul fungsional lengkap.
- ⚙️ [**03-TRD.md**](docs/03-TRD.md) — *Technical Requirements Document*: Arsitektur Next.js 15, Vercel deployment, backend Go Gin, dan model data.

---

## 🛠️ Tumpukan Teknologi

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@dnd-kit`, Zustand
- **Hosting Target**: Vercel (Edge / Serverless)
- **Backend Eksperimen**: Go 1.22 + Gin Framework (`apps/api-go`)
- **Penyimpanan**: Local-First (IndexedDB / LocalStorage) dengan cadangan JSON
