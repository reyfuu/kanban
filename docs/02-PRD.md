# PRD — Product Requirements Document
## HoyoKanban: Platform Kanban & Manajemen Progres Game (Genshin Impact & ZZZ)

| Atribut | Keterangan |
|---|---|
| **Produk** | HoyoKanban v1.0.0 |
| **Dokumen** | Product Requirements Document (PRD) |
| **Status** | Approved for Implementation |
| **Penyusun** | Product Management & Game Experience Architect |
| **Audiens** | Frontend Developers, Backend Developers, UI/UX Designer |

---

## 1. Visi Produk & Nilai Pengguna (Product Vision)

**HoyoKanban** adalah asisten produktivitas visual berdesain modern yang mengubah proses *grinding* dan pembangunan karakter game gacha (**Genshin Impact** dan **Zenless Zone Zero**) dari catatan spreadsheet yang membosankan menjadi alur kerja **Kanban yang interaktif, menyenangkan, dan memuaskan**.

### Mengapa Produk Ini Ada?
- **Pemain Kewalahan**: Rata-rata pemain aktif memiliki 30+ karakter tetapi hanya punya energi harian terbatas (Resin/Battery). Membangun 1 karakter butuh waktu 3-4 minggu. Tanpa prioritas visual, pemain sering salah farming atau memecah fokus terlalu banyak.
- **Kebutuhan Sentralisasi Multi-Game**: Pemain yang memainkan Genshin dan ZZZ secara bersamaan butuh 1 dashboard terpadu untuk memeriksa stamina live, rotasi domain harian, dan antrean build tanpa harus membuka game satu per satu.
- **Kemudahan Akses Tanpa Biaya**: Web dashboard yang ringan, ramah mobile, dapat di-hosting secara mandiri di **Vercel** dengan arsitektur *Local-First* tanpa server database berbayar.

---

## 2. Epics & User Stories (dengan Acceptance Criteria)

### Epic 1: Manajemen Papan Kanban (Kanban Board Management)

#### US-1.1: Memindahkan Karakter Antar Tahap Build
> **Sebagai** pemain yang sedang membangun tim baru,  
> **Saya ingin** menggeser kartu karakter dari satu kolom (misal: *Acquired*) ke kolom lain (misal: *Leveling & Ascension*),  
> **Agar** saya memiliki kejelasan visual tentang apa fokus farming saya saat ini.

- **Kriteria Penerimaan (Acceptance Criteria)**:
  - *Given*: Pengguna berada di halaman Papan Kanban dengan kartu karakter "Ellen Joe" di kolom "Acquired".
  - *When*: Pengguna melakukan drag kartu ke kolom "Level & Ascension" dan melepasnya (drop).
  - *Then*: Kartu berpindah secara instan dengan animasi halus, state tersimpan di storage lokal, dan kolom tujuan ter-update tanpa reload halaman.

#### US-1.2: Filter Berdasarkan Game & Elemen
> **Sebagai** pemain yang saat ini hanya fokus bermain Zenless Zone Zero,  
> **Saya ingin** menyaring papan agar hanya menampilkan karakter ZZZ dan atribut tertentu (misal: Ice/Electric),  
> **Agar** papan kanban tidak berantakan oleh karakter game lain yang sedang tidak saya urus.

- **Kriteria Penerimaan**:
  - *Given*: Papan kanban menampilkan karakter campuran Genshin dan ZZZ.
  - *When*: Pengguna menekan tombol filter "ZZZ Only".
  - *Then*: Seluruh kartu Genshin disembunyikan seketika; hanya kartu agen ZZZ yang tampil beserta jumlah hitungan kartu per kolom yang ter-update.

---

### Epic 2: Profil & Kalkulator Defisit Karakter (Character Progression & Calculator)

#### US-2.1: Menentukan Target Level & Talenta
> **Sebagai** pemain yang baru mendapatkan Raiden Shogun (Level 1),  
> **Saya ingin** menentukan target build: Level 90, Senjata The Catch R5 Lv 90, dan Talenta 1/9/10,  
> **Agar** sistem menghitung secara otomatis berapa material yang harus saya kumpulkan.

- **Kriteria Penerimaan**:
  - *Given*: Pengguna membuka modal detail untuk kartu karakter.
  - *When*: Pengguna memilih Level Saat Ini = 1 dan Target Level = 90, serta Talenta Burst = 10.
  - *Then*: Sistem menampilkan rincian defisit: jumlah Hero's Wit (419 buah), Mora (2.092.530), Material Boss (46 Storm Beads), dan Buku Talenta (Philosophies of Light).

---

### Epic 3: Stamina Hub & Rutinitas Game (Stamina Hub & Daily Checklist)

#### US-3.1: Pelacak Waktu Penuh Resin & Battery
> **Sebagai** pemain yang sedang bekerja di kantor,  
> **Saya ingin** melihat sisa waktu hingga Original Resin (cap 200) atau Battery Charge (cap 240) saya penuh,  
> **Agar** energi tidak meluap (*capped*) dan terbuang sia-sia.

- **Kriteria Penerimaan**:
  - *Given*: Pengguna menginput Resin saat ini = 120 pada pukul 12:00.
  - *When*: Halaman dashboard dibuka kembali pada pukul 16:00 (4 jam = 240 menit = 30 resin bertambah).
  - *Then*: Nilai resin otomatis terhitung menjadi 150/200, dan tertera perkiraan jam penuh (pukul 22:40 WIB).

#### US-3.2: Checklist Rutinitas Harian & Kopi ZZZ
> **Sebagai** pemain,  
> **Saya ingin** mencentang komisi harian, 3x weekly boss, dan minum kopi Coff Cafe ZZZ (+60 Battery),  
> **Agar** saya tidak melewatkan jatah energi gratis dan primogem/polychrome harian.

- **Kriteria Penerimaan**:
  - *Given*: Pengguna membuka widget Checklist Harian.
  - *When*: Pengguna mencentang "Minum Kopi ZZZ (+60 Battery)".
  - *Then*: Checklist tercentang, nilai battery ZZZ bertambah 60 poin secara otomatis, dan status ter-reset pada pergantian hari (04:00 server reset).

---

### Epic 4: Kalender Rotasi Farming Harian (Daily Farming Schedule)

#### US-4.1: Mengetahui Domain yang Buka Hari Ini
> **Sebagai** pemain yang ingin farming secara efektif,  
> **Saya ingin** melihat jadwal buku talenta dan material senjata yang sedang terbuka hari ini,  
> **Agar** saya langsung tahu karakter mana yang harus saya prioritaskan hari ini.

- **Kriteria Penerimaan**:
  - *Given*: Hari ini adalah hari Rabu (WIB).
  - *When*: Pengguna melihat tab Kalender Farming.
  - *Then*: Sistem menyorot domain buku "Ballad/Gold/Light" dan menampilkan avatar karakter di papan kanban pengguna yang membutuhkan buku tersebut (badge: "Tersedia Hari Ini!").

---

### Epic 5: Tabungan Gacha & Pity Calculator (Gacha Planner)

#### US-5.1: Menghitung Peluang Tarikan Karakter Incaran
> **Sebagai** pemain F2P yang menghemat primogem/polychrome,  
> **Saya ingin** memasukkan jumlah primogem dan pity saya saat ini untuk melihat berapa tarikan (*pulls*) yang saya miliki,  
> **Agar** saya tahu apakah tabungan saya cukup untuk mencapai hard pity garansi (50/50).

- **Kriteria Penerimaan**:
  - *Given*: Pengguna memiliki 8.000 Primogem, 5 Intertwined Fates, dan pity counter saat ini = 40 (status 50/50).
  - *When*: Pengguna membuka tab Gacha Planner.
  - *Then*: Sistem menghitung total pull = 55 pulls ($8000/160 + 5$), total tarikan kumulatif = 95 pulls, dan memberi konfirmasi bahwa pengguna telah mencapai batas 1x bintang 5 (soft pity 75-90).

---

### Epic 6: Portabilitas Data & Backup (Data Portability)

#### US-6.1: Ekspor dan Impor JSON
> **Sebagai** pengguna yang mengakses aplikasi dari laptop dan smartphone,  
> **Saya ingin** mengekspor seluruh kartu dan target saya menjadi file JSON dan mengimpornya di smartphone,  
> **Agar** progres saya sinkron tanpa perlu login akun atau registrasi database server yang rumit.

- **Kriteria Penerimaan**:
  - *Given*: Pengguna menekan tombol "Backup Data".
  - *When*: Berkas `hoyokanban-backup-<tanggal>.json` diunduh dan diunggah kembali di perangkat lain.
  - *Then*: Seluruh kartu kanban, konfigurasi level, dan pengaturan checklist langsung dipulihkan secara identik dengan validasi integritas data.

---

## 3. Desain Pengalaman Pengguna (UX & Design Guidelines)

1. **Nuansa Visual**:
   - Gaya **Dark Mode Gaming / Cyberpunk Fantasy**: Menggabungkan warna elemen Genshin (Anemo Teal, Pyro Orange, Electro Violet, Dendro Green, Hydro Blue, Cryo Cyan, Geo Gold) dengan gaya aksen neon kontras khas ZZZ (Electric Yellow, Ether Magenta, Crimson Red).
2. **Kerapian & Kepadatan Data**:
   - Informasi kartu kanban dibuat ringkas (*compact card*) agar dapat menampilkan 5-7 kartu per kolom tanpa perlu *scrolling* berlebihan.
   - Modal detail karakter dirancang dengan *tabbed navigation*: Tab Leveling, Tab Talenta, Tab Senjata, Tab Relic/Gear, Tab Ringkasan Material.
3. **Responsivitas Ponsel (Mobile First)**:
   - Pada layar smartphone (< 768px), kolom kanban dapat digeser secara horizontal (*horizontal swipe*) dengan navigasi tab cepat per kolom di bagian atas.

---

## 4. Matriks Rilis & Kriteria Peluncuran (Launch Checklist)

| Tahap | Fitur Utama | Target Kesiapan |
|---|---|---|
| **MVP (Vercel)** | Papan Kanban drag-and-drop, katalog karakter awal Genshin & ZZZ, modal target level & talenta, kalkulator material defisit, live stamina hub, penyimpanan Local-First + Ekspor/Impor JSON. | **Siap Dijalankan Sekarang** |
| **Fase 2** | Kalender rotasi farming harian otomatis, Gacha & Pity savings planner, scaffold backend Go Gin (`apps/api-go`) untuk optimasi alokasi resin mingguan. | Menyusul |
| **Fase 3** | Sinkronisasi showcase UID Enka.Network, PWA offline install banner, visualisasi formasi tim Spiral Abyss & Shiyu Defense. | Versi 1.1 |
