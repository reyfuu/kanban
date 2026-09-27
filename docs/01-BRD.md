# BRD — Business Requirements Document
## HoyoKanban: Sistem Kanban & Pelacak Progres Karakter (Genshin Impact & Zenless Zone Zero)

| Atribut | Keterangan |
|---|---|
| **Nama Proyek** | HoyoKanban (Genshin & ZZZ Character Build & Progress Tracker) |
| **Versi Dokumen** | 1.0.0 |
| **Tanggal** | 27 September 2026 |
| **Penyusun** | Lead Developer & Game Progression Architect |
| **Target Platform** | Web Desktop & Mobile (Next.js di Vercel) + Backend Eksperimen (Go / Gin) |
| **Status** | Approved for Development |

---

## 1. Ringkasan Eksekutif (Executive Summary)

Pemain aktif game aksi RPG gacha besutan HoYoverse — khususnya **Genshin Impact** dan **Zenless Zone Zero (ZZZ)** — menghadapi kompleksitas progres karakter yang sangat tinggi dan fragmentasi informasi harian. 

Setiap karakter membutuhkan investasi sumber daya yang sangat terbatas oleh batas energi harian (**Original Resin** di Genshin Impact dan **Battery Charge** di Zenless Zone Zero). Pemain harus mengelola puluhan variabel secara bersamaan:
1. **Level & Ascension**: Karakter level 1 hingga 90 (Genshin) atau 1 hingga 60 (ZZZ), membutuhkan boss material, local specialties/seals, dan enemy drops.
2. **Skill & Talents**: Buku talenta dengan rotasi hari tertentu, weekly boss drops, tactical chips, dan Higher-Dimensional Data.
3. **Equipment & Relics**: 5 slot Artifact (Genshin) atau 6 slot Drive Disc (ZZZ) dengan main stat dan substat yang membutuhkan optimasi berulang.
4. **Weapons & W-Engines**: Material domain rotasi mingguan dan peningkatan rank/overclock.
5. **Rotasi Harian & Mingguan**: Domain talenta dan senjata yang hanya terbuka pada hari tertentu (Senin/Kamis, Selasa/Jumat, Rabu/Sabtu, Minggu), serta batas mingguan Trounce Domains dan Notorious Hunts.

Alat bantu yang ada saat ini (seperti spreadsheet manual atau kalkulator web statis) umumnya kaku, tidak memiliki konsep alur kerja visual (*workflow*), terpisah antar game, dan tidak memberikan kejelasan mengenai karakter mana yang sedang aktif difarming, tertunda (*backlog*), atau sudah siap tempur (*combat-ready*).

**HoyoKanban** diciptakan untuk menyelesaikan masalah ini dengan mengadopsi metodologi **Kanban visual**. Karakter diposisikan sebagai "kartu tugas" yang bergerak secara bertahap melalui kolom tahapan progres (mulai dari *Wishlist/Target Pull*, *Farming Material*, *Leveling*, *Artifact/Disc Tuning*, hingga *Abyss/Shiyu Ready*). Dilengkapi dengan kalkulator defisit material otomatis, pelacak stamina waktu-nyata, jadwal rotasi domain harian, dan kalkulator tabungan gacha/pity.

Sistem dirancang dengan arsitektur modern:
- **Frontend Utama**: **Next.js** (App Router, Tailwind CSS, TypeScript) yang siap dihosting dengan performa instan tanpa biaya server di **Vercel**.
- **Backend Eksperimen**: **Go (Gin Framework)** sebagai layanan performa tinggi untuk eksperimen kalkulasi rute farming optimal, sinkronisasi showcase Enka/HoyoLab, dan pengelolaan antrean.

---

## 2. Masalah & Peluang (Problem Statement & Opportunities)

### 2.1 Masalah Utama Pengguna
1. **Inefisiensi Alokasi Energi (Resin / Battery)**:
   - Stamina game beregenerasi lambat (1 Resin per 8 menit di Genshin, 1 Battery per 6 menit di ZZZ). Kesalahan mengalokasikan resin pada hari domain yang salah atau material yang berlebih memperlambat kesiapan tim hingga berminggu-minggu.
2. **Ketiadaan Visibilitas Alur Kerja (Workflow Visibility)**:
   - Pemain memiliki puluhan karakter yang ingin dibangun, namun bingung menentukan prioritas. Tidak ada representasi visual yang jelas mengenai status masing-masing karakter: mana yang tinggal cari artifact/disc, mana yang kekurangan buku talenta, dan mana yang sudah tuntas.
3. **Beban Kognitif Rotasi Harian**:
   - Pemain sering lupa hari rotasi domain buku talenta atau material senjata karakter tertentu, sehingga kehilangan momentum farming mingguan.
4. **Fragmentasi Multi-Game**:
   - Pemain yang memainkan kedua game (Genshin & ZZZ) harus berpindah-pindah aplikasi atau catatan terpisah untuk memeriksa stamina dan progres masing-masing game.

### 2.2 Peluang & Nilai Tambah Solusi
- **Kanban Board Intuitif**: Drag-and-drop kartu karakter antar tahap build memberikan kepuasan progres visual (*gamified productivity*).
- **Auto Material Deficit Calculation**: Pengguna cukup memilih level saat ini dan level target (misal Level 70/70 ke 90/90, Talenta 6/6/6 ke 9/9/9), sistem otomatis menghitung jumlah pasti material yang kurang.
- **Unified Daily Hub**: Satu layar untuk memantau waktu penuh Resin Genshin (cap 200) dan Battery ZZZ (cap 240), kopi harian ZZZ, checklist komisi harian, dan weekly boss.
- **Zero-Cost Hosting di Vercel**: Memanfaatkan arsitektur local-first (IndexedDB) dan serverless Next.js sehingga pengguna dapat menghosting kanban pribadinya di Vercel tanpa biaya operasional.
- **High-Performance Go Backend Sandbox**: Backend berbasis Go/Gin disiapkan sebagai lingkungan eksperimen untuk algoritma pemaksimalan efisiensi resin (*greedy farming path optimization*) dan agregasi API publik.

---

## 3. Sasaran Proyek (Project Goals & Objectives)

| ID | Sasaran (Objective) | Kriteria Keberhasilan (Success Metric) |
|---|---|---|
| **GOAL-01** | Pengalaman Kanban yang Mulus | Perpindahan kartu karakter antar kolom kanban responsif (< 16ms render rate / 60fps) dengan penyimpanan otomatis instan. |
| **GOAL-02** | Akurasi Perhitungan Material | 100% presisi perhitungan material leveling, ascension, talenta/skill, dan senjata/W-Engine sesuai formula resmi HoYoverse. |
| **GOAL-03** | Kemudahan Akses & Hosting | Dapat dideploy ke platform Vercel hanya dengan satu klik / git push, responsif pada layar desktop maupun smartphone. |
| **GOAL-04** | Dukungan Dua Game Utama | Menyediakan basis data lengkap untuk seluruh karakter playable Genshin Impact dan Zenless Zone Zero (ZZZ), mudah diperbarui untuk patch masa depan. |
| **GOAL-05** | Eksperimentasi Backend Go | Menyediakan modul Go (Gin) terpisah yang mampu melayani kalkulasi rute material dalam < 5ms dan siap menerima data showcase UID publik. |

---

## 4. Persona Pengguna (User Personas)

### 4.1 Persona 1: Arya — The Dual-Game Daily Grinder
- **Karakteristik**: Memainkan Genshin Impact (AR 58) dan Zenless Zone Zero (Inter-Knot Level 52) setiap hari sepulang kerja.
- **Kebutuhan**:
  - Ingin melihat sekilas apakah Resin atau Battery-nya sudah penuh sebelum membuka PC/game.
  - Ingin checklist cepat: komisi harian selesai, kopi harian ZZZ diminum, dan weekly boss 3x sudah diklaim.
  - Ingin tahu material apa yang bisa difarming hari ini sesuai karakter yang sedang dibangun.

### 4.2 Persona 2: Cynthia — The Endgame Tactician
- **Karakteristik**: Fokus menyelesaikan Spiral Abyss lantai 12 (36 bintang) di Genshin dan Shiyu Defense Critical Node (S-Rank) di ZZZ.
- **Kebutuhan**:
  - Menyusun 2 tim inti untuk Abyss dan Shiyu Defense.
  - Melacak status artifact (CRIT Rate/DMG target) dan Drive Disc (Disc 4/5/6 main stat).
  - Kolom Kanban khusus untuk karakter yang butuh "Fine-Tuning / Min-Max" sebelum dinyatakan lulus uji coba.

### 4.3 Persona 3: Budi — The F2P+ Strategic Planner
- **Karakteristik**: Menghemat Primogem dan Polychrome untuk banner karakter yang akan datang.
- **Kebutuhan**:
  - Menempatkan karakter masa depan di kolom "Wishlist / Pre-Farm".
  - Memprediksi apakah tabungan primogem/polychrome cukup untuk pity garansi (50/50 vs guarantee).
  - Mulai menimbun (*pre-farming*) material bos dan buku sebelum banner karakter rilis.

---

## 5. Ruang Lingkup Proyek (Scope of Work)

### 5.1 In-Scope (Termasuk dalam Ruang Lingkup)
1. **Manajemen Board Kanban**:
   - Kolom status standar: *Wishlist/Pre-Farm*, *Backlog/Acquired*, *Leveling & Ascension*, *Talents & Skills*, *Gear & Relics*, *Fine-Tuning*, *Ready/Completed*.
   - Filter board berdasarkan Game (Genshin, ZZZ, Semua), Element/Attribute, Peran (DPS, Sub-DPS, Support, Stun, Anomaly, Defense), dan Tingkat Prioritas (Tinggi, Sedang, Rendah).
2. **Katalog & Detail Karakter**:
   - Basis data karakter Genshin Impact (Elemen, Senjata, Material Ascension, Buku Talenta, Weekly Boss).
   - Basis data agen Zenless Zone Zero (Atribut, Specialty, Faction, Certification Seal, Tactical Chips, Higher-Dimensional Data).
   - Pengaturan target level, talenta/skill, senjata/W-Engine, dan artifact/drive disc target.
3. **Kalkulator Defisit Sumber Daya**:
   - Perhitungan selisih material antara kondisi sekarang (*current*) dan target (*target*).
   - Ringkasan total kebutuhan Mora / Denny, EXP books / Trainee logs.
4. **Progress Hub & Stamina Tracker**:
   - Timer regenerasi Original Resin (0–200, 8 min/resin) dan Battery Charge (0–240, 6 min/battery).
   - Perkiraan jam berapa stamina akan penuh (*full cap alert*).
   - Checklist harian dan mingguan (Daily Commissions, Errands, Trounce Domains, Notorious Hunts, Hollow Zero).
5. **Kalender Rotasi Farming Harian**:
   - Tampilan jadwal domain berdasarkan hari kalender lokal (WIB/UTC+7).
   - Penanda otomatis (*highlight*) jika ada karakter di board yang membutuhkan domain yang buka hari ini.
6. **Kalkulator Tabungan Gacha & Pity**:
   - Pelacak pity saat ini, status garansi 50/50.
   - Konversi Primogem/Polychrome + Fates/Tapes menjadi total pulls yang tersedia.
7. **Arsitektur Dual & Hosting Vercel**:
   - Frontend Next.js 15 siap deploy ke Vercel dengan konfigurasi zero-downtime.
   - Opsi penyimpanan Local-First (IndexedDB / LocalStorage) dengan fitur Ekspor/Impor berkas JSON (backup aman).
   - Backend Go (Gin) sebagai microservice eksperimen untuk kalkulasi berat dan sinkronisasi showcase.

### 5.2 Out-of-Scope (Tidak Termasuk)
1. **Injeksi Memori atau Otomatisasi Input Game**: Sistem tidak melakukan scraping memori langsung dari klien game yang berjalan (menghindari risiko banned ToS HoYoverse).
2. **Transaksi Uang Nyata / Pembelian In-Game**: Tidak ada gateway pembayaran untuk membeli item game.
3. **Simulasi Pertarungan Penuh**: Tidak melakukan kalkulasi damage frame-by-frame penuh (fokus pada progres build dan manajemen alur kerja kanban).

---

## 6. Batasan & Asumsi (Constraints & Assumptions)

### 6.1 Batasan (Constraints)
- **Deployment Vercel**: Fungsi frontend dan serverless routes harus tunduk pada batas eksekusi Vercel Free Tier (10 detik timeout untuk serverless function, ukuran bundle efisien).
- **Backend Go**: Bersifat eksperimental dan opsional; sistem frontend harus tetap berfungsi penuh (*standalone*) meskipun backend Go dimatikan atau belum dijalankan.
- **Penyimpanan Data Pengguna**: Secara default menggunakan *local-first storage* di browser pengguna agar tidak memerlukan infrastruktur database berbayar yang rumit untuk penggunaan personal.

### 6.2 Asumsi (Assumptions)
- Pengguna memiliki koneksi internet untuk mengunduh asset gambar karakter/icon (disimpan di CDN atau asset lokal publik).
- Aturan regenerasi stamina mengikuti versi game terbaru: Genshin Impact cap 200 (1 per 8 menit), ZZZ cap 240 (1 per 6 menit).
- Pengguna dapat mengekspor data kanban mereka ke format JSON untuk dipindahkan antar perangkat jika menggunakan mode standalone local-first.

---

## 7. Rencana Fase Rilis (Roadmap)

```
+-----------------------------------------------------------------------+
| FASE 1: MVP Next.js di Vercel (Stand-Alone Ready)                     |
| - Setup Next.js 15 + Tailwind CSS + Dnd-Kit                           |
| - Katalog Karakter Genshin & ZZZ                                      |
| - Papan Kanban Drag-and-Drop + Filter Game/Elemen                     |
| - Modal Detail Karakter & Kalkulator Material Defisit                 |
| - Stamina Hub (Resin/Battery timer) & LocalStorage/IndexedDB Storage  |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| FASE 2: Backend Go (Gin) Sandbox & Fitur Lanjutan                     |
| - Scaffold Microservice Go Gin di `apps/api-go`                       |
| - Algoritma Greedy Resin/Battery Optimizer (Rute Farming Terbaik)     |
| - Eksperimen Integrasi Enka.Network / Showcase Fetcher via UID        |
| - Sinkronisasi Data Antara Next.js Frontend dan Go Backend            |
+-----------------------------------------------------------------------+
                                  |
                                  v
+-----------------------------------------------------------------------+
| FASE 3: Polish & Komunitas                                            |
| - PWA Support (Offline Mode & Mobile Add to Home Screen)              |
| - Visualisasi Tim Abyss & Shiyu Defense                               |
| - Kalkulator Rating Substat Artifact & Drive Disc                     |
+-----------------------------------------------------------------------+
```
