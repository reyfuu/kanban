# FRD — Functional Requirements Document
## HoyoKanban: Spesifikasi Kebutuhan Fungsional

| Atribut | Keterangan |
|---|---|
| **Dokumen** | Functional Requirements Document (FRD) |
| **Produk** | HoyoKanban v1.0.0 |
| **Target Pengguna** | Pemain Genshin Impact & Zenless Zone Zero |
| **Arsitektur** | Next.js 15 (Frontend Vercel-ready) + Go 1.22 / Gin (Backend Sandbox) |
| **Status** | Baseline |

---

## 1. Peta Modul Sistem

Sistem HoyoKanban terbagi menjadi 7 modul fungsional:

```
+---------------------------------------------------------------------------------+
|                                HOYOKANBAN SYSTEM                                |
+---------------------------------------------------------------------------------+
|  [MODUL 1: FR-KB]  |  [MODUL 2: FR-CH]  |  [MODUL 3: FR-MC]  |  [MODUL 4: FR-ST]   |
|  Papan Kanban      |  Profil & Target   |  Kalkulator        |  Stamina Hub &     |
|  Build Karakter    |  Build Karakter    |  Defisit Material  |  Rutinitas Game    |
+--------------------+--------------------+--------------------+--------------------+
|  [MODUL 5: FR-FS]  |  [MODUL 6: FR-GC]  |  [MODUL 7: FR-EX]  |  [MODUL 8: FR-DM]   |
|  Kalender Rotasi   |  Tabungan Gacha    |  Eksperimen Go     |  Manajemen Data &  |
|  Farming Harian    |  & Pity Planner    |  Gin Backend       |  Portabilitas JSON |
+---------------------------------------------------------------------------------+
```

---

## 2. Modul 1: Papan Kanban Build Karakter (FR-KB)

### FR-KB-001: Definisi Kolom Alur Kerja (Default Stages)
Sistem harus menyediakan 7 kolom alur kerja standar yang merefleksikan siklus hidup nyata pembangunan karakter di Genshin Impact dan Zenless Zone Zero:

| Urutan | ID Kolom | Nama Kolom | Deskripsi Alur |
|---|---|---|---|
| 1 | `STAGE_WISHLIST` | **Wishlist / Target Pull** | Karakter incaran masa depan atau banner mendatang; tahap pre-farming ide. |
| 2 | `STAGE_BACKLOG` | **Acquired / In Queue** | Karakter sudah dimiliki (biasanya Lv 1 atau 20), masuk antrean tunggu build. |
| 3 | `STAGE_LEVELING` | **Level & Ascension** | Sedang aktif farming EXP books/logs, boss drops, dan material ascensi. |
| 4 | `STAGE_TALENTS` | **Skills & Talents** | Karakter sudah naik level; sedang fokus farming buku talenta/tactical chips. |
| 5 | `STAGE_GEAR` | **Gear & Relics** | Sedang farming domain Artifact (Genshin) atau Drive Disc Tuning (ZZZ). |
| 6 | `STAGE_TUNING` | **Fine-Tuning / Min-Max** | Menyempurnakan substat (Crit Rate/DMG, ER, Anomaly), mahkota talenta (Crown). |
| 7 | `STAGE_READY` | **Combat Ready** | Karakter siap bertarung di Spiral Abyss Floor 12 atau Shiyu Defense Critical. |

### FR-KB-002: Interaksi Drag-and-Drop
- Pengguna dapat memindahkan kartu karakter dari satu kolom ke kolom lain menggunakan mouse drag (desktop) atau touch-and-drag (mobile).
- Posisi kartu dalam kolom yang sama dapat diurutkan ulang (*reordered*).
- Setiap perpindahan kolom harus otomatis memicu penyimpanan state ke storage tanpa tombol "Save" manual (*optimistic update*).
- Terdapat indikator visual kolom tujuan saat kartu sedang di-drag (*drop target highlight*).

### FR-KB-003: Komponen Kartu Karakter (Kanban Card)
Setiap kartu pada papan kanban harus menampilkan informasi ringkas:
- **Header Kartu**: Foto Avatar Karakter, Badge Game (`Genshin` atau `ZZZ`), Icon Elemen/Atribut (Pyro, Hydro, Anemo, Electric, Ether, Physical, dll).
- **Body Kartu**: Nama Karakter, Rarity (Bintang 4/5 atau Rank A/S), Target Level (contoh: `Lv 80/90`), Icon Senjata/W-Engine terpasang.
- **Indikator Progres**: Progress bar persentase (0–100%) berdasarkan pemenuhan target level, talenta, dan gear.
- **Badge Prioritas**: Label `Tinggi` (Merah), `Sedang` (Kuning), `Rendah` (Abu-abu).
- **Tag Khusus**: Tag kustom pengguna (contoh: "Abyss Team 1", "Main DPS", "Mono Pyro").

### FR-KB-004: Filter dan Pencarian
- **Game Switcher**: Tombol cepat untuk menampilkan `Semua Game`, `Hanya Genshin Impact`, atau `Hanya Zenless Zone Zero`.
- **Elemen/Atribut Filter**: Filter multi-pilih berdasarkan elemen (Pyro, Hydro, Cryo, Electro, Dendro, Anemo, Geo / Fire, Ice, Electric, Physical, Ether).
- **Peran / Specialty**: Filter berdasarkan peran (Main DPS, Sub DPS, Support, Healer, Shielder / Attack, Stun, Anomaly, Support, Defense).
- **Kotak Pencarian Teks**: Pencarian instan berdasarkan nama karakter.

### FR-KB-005: Pembatasan Beban Kerja (WIP Limits - Work In Progress)
- Pengguna dapat menyetel batas maksimal karakter pada kolom aktif (khususnya kolom *Leveling*, *Talents*, dan *Gear*).
- Bila jumlah kartu melebihi batas (misal > 3 karakter sedang difarming bersamaan), kolom menampilkan peringatan visual berwarna oranye: *"Terlalu banyak fokus aktif akan memecah alokasi Resin/Battery Anda."*

---

## 3. Modul 2: Profil & Target Build Karakter (FR-CH)

### FR-CH-001: Katalog Karakter Preset
- Sistem menyediakan data bawaan (*built-in database*) seluruh karakter playable Genshin Impact dan Zenless Zone Zero.
- Setiap entri karakter memuat: ID unik, nama, rarity, elemen/atribut, tipe senjata/specialty, gambar avatar, material boss yang dibutuhkan, buku talenta/chips, dan weekly boss drop.

### FR-CH-002: Form Konfigurasi Target Genshin Impact
Pengguna dapat membuka modal detail karakter Genshin dan mengatur:
- **Level & Ascension**: Level Saat Ini (1–90) vs Target Level (1–90), Fase Ascension (0–6).
- **Talenta (3 Skill)**:
  - Normal Attack (Lv 1–10) saat ini vs target.
  - Elemental Skill (Lv 1–10) saat ini vs target.
  - Elemental Burst (Lv 1–10) saat ini vs target.
- **Senjata (Weapon)**:
  - Pilihan senjata dari katalog (Bintang 3, 4, 5).
  - Level saat ini (1–90) vs target (1–90).
  - Refinement Rank (R1–R5).
- **Artifact Set & Main Stats**:
  - Target Set 1 & Set 2 (atau 4-piece set).
  - Target Main Stat untuk: Sands (ATK%/ER/EM/HP%), Goblet (Elem DMG%/ATK%/Physical), Circlet (CRIT Rate/CRIT DMG/Healing%).
  - Catatan target substat (contoh: "Target minimal 65% CR / 150% CD").

### FR-CH-003: Form Konfigurasi Target Zenless Zone Zero (ZZZ)
Pengguna dapat membuka modal detail agen ZZZ dan mengatur:
- **Level & Promotion**: Level Saat Ini (1–60) vs Target Level (1–60), Promotion Rank (0–5).
- **Skills (6 Kategori)**:
  - Basic Attack (Lv 1–12) saat ini vs target.
  - Dodge (Lv 1–12) saat ini vs target.
  - Assist (Lv 1–12) saat ini vs target.
  - Special Attack (Lv 1–12) saat ini vs target.
  - Chain Attack / Ultimate (Lv 1–12) saat ini vs target.
  - Core Skill (Rank A–F) saat ini vs target.
- **W-Engine**:
  - Pilihan W-Engine dari katalog (Rank B, A, S).
  - Level saat ini (1–60) vs target (1–60).
  - Overclock Rank (1–5).
- **Drive Disc Set & Main Stats**:
  - Target 4-piece set dan 2-piece set.
  - Target Main Stat untuk Disc 4 (Crit Rate/DMG, ATK%, Anomaly Prof), Disc 5 (Attribute DMG%, PEN Ratio, ATK%), Disc 6 (Energy Regen, Impact, Anomaly Mastery, ATK%).

### FR-CH-004: Catatan Pribadi (Personal Notes)
- Kolom teks bebas markdown untuk setiap kartu karakter untuk mencatat tips rotasi, komposisi tim, atau pengingat build.

---

## 4. Modul 3: Kalkulator Defisit Material (FR-MC)

### FR-MC-001: Mesin Kalkulasi Otomatis (Calculation Engine)
- Menghitung secara otomatis selisih kebutuhan sumber daya antara nilai *Saat Ini* dan nilai *Target*.
- Menampilkan daftar material yang dibutuhkan secara terperinci lengkap dengan icon dan jumlah defisit.

### FR-MC-002: Matriks Material Genshin Impact

```
+---------------------------------------------------------------------------------+
| DEFISIT MATERIAL GENSHIN IMPACT                                                 |
+---------------------------------------------------------------------------------+
| Mata Uang      : Mora                                                           |
| EXP Karakter   : Hero's Wit (20.000 XP), Adventurer's Exp (5.000 XP)            |
| Permata Elemen : Sliver -> Fragment -> Chunk -> Gemstone                        |
| Boss Drop      : Material Boss Regional (misal: Juvenile Jade, Shivada Jade)    |
| Local Specialty: Tanaman/Mineral Lokal (misal: Cecilias, Naku Weed, Lakelight)  |
| Enemy Common   : Tetesan Musuh Tier 1, Tier 2, Tier 3 (misal: Handguard, Insignia)|
| Buku Talenta   : Teaching -> Guide -> Philosophies (Domain Harian)              |
| Weekly Boss    : Trounce Domain Material (misal: Dvalin Plume, Shadow of Gilded)|
| Mahkota        : Crown of Insight (untuk Talenta Lv 10)                         |
| Senjata        : Ore Tempa Senjata + Material Domain Senjata                    |
+---------------------------------------------------------------------------------+
```

### FR-MC-003: Matriks Material Zenless Zone Zero (ZZZ)

```
+---------------------------------------------------------------------------------+
| DEFISIT MATERIAL ZENLESS ZONE ZERO (ZZZ)                                        |
+---------------------------------------------------------------------------------+
| Mata Uang      : Denny                                                          |
| EXP Agen       : Trainee Log (1.000 XP) -> Senior Log -> Investigator Log       |
| Promotion Seal : Basic Seal -> Advanced Seal -> Specialized Seal (Attack/Stun..) |
| Tactical Chips : Basic Chip -> Advanced Chip -> Specialized Chip (Elemen)       |
| High-Dim Data  : Higher-Dimensional Data (Expert Challenge)                     |
| Notorious Hunt : Material Weekly Boss (misal: Living Drive, Finale Dance Shoes) |
| Hamster Pass   : Hamster Cage Pass (untuk Core Skill Max)                       |
| W-Engine Mats  : Component Battery & Modification Kits                          |
+---------------------------------------------------------------------------------+
```

### FR-MC-004: Estimasi Kebutuhan Resin & Hari Farming
- Mengestimasi total Original Resin (Genshin) atau Battery Charge (ZZZ) yang dibutuhkan berdasarkan perkiraan drop rata-rata per run domain/simulasi.
- Mengestimasi berapa hari farming yang dibutuhkan jika seluruh resin/battery harian dialokasikan untuk karakter tersebut.

---

## 5. Modul 4: Stamina Hub & Rutinitas Game (FR-ST)

### FR-ST-001: Pelacak Original Resin Genshin Impact
- **Input Saat Ini**: Input nilai Resin saat ini (0–200).
- **Auto-Increment Timer**: Menghitung penambahan 1 Resin setiap 480 detik (8 menit) secara presisi menggunakan timestamp terakhir.
- **Prediksi Waktu Penuh**: Menampilkan perkiraan jam dan tanggal saat Resin mencapai 200/200 (misal: *"Penuh hari ini pukul 19:42 WIB"*).
- **Koleksi Tambahan**: Penghitung Condensed Resin (0–5) dan Transient Resin.

### FR-ST-002: Pelacak Battery Charge Zenless Zone Zero
- **Input Saat Ini**: Input nilai Battery saat ini (0–240).
- **Auto-Increment Timer**: Menghitung penambahan 1 Battery setiap 360 detik (6 menit) secara presisi.
- **Prediksi Waktu Penuh**: Menampilkan perkiraan jam dan tanggal saat Battery mencapai 240/240.
- **Coffee Boost Check**: Tombol toggle harian *"Minum Kopi Coff Cafe (+60 Battery)"*.

### FR-ST-003: Checklist Rutinitas Harian (Daily Routine)
- Genshin: Daily Commissions / Encounter Points (4/4), Claim Katheryne Bonus, Habiskan Resin.
- ZZZ: Inter-Knot Daily Errands, Scratch Card (Newsstand Howl), Coff Cafe (+60 Battery), Habiskan Battery.
- Fitur reset checklist harian otomatis setiap pukul 04:00 waktu server (WIB/UTC+7).

### FR-ST-004: Checklist Rutinitas Mingguan (Weekly Routine)
- Genshin: Trounce Domains (3x diskon 30 Resin), Bounties & Requests, Realm Currency Teapot.
- ZZZ: 3x Notorious Hunt gratis, Hollow Zero Weekly Bounty Points (investigation points).
- Indikator reset Spiral Abyss (tiap tanggal 16) & Shiyu Defense Critical Node (tiap 2 minggu).

---

## 6. Modul 5: Kalender Rotasi Farming Harian (FR-FS)

### FR-FS-001: Deteksi Hari Kalender Lokal
- Mengambil hari saat ini (Senin s/d Minggu) berdasarkan zona waktu lokal pengguna.

### FR-FS-002: Jadwal Rotasi Domain Genshin Impact
- **Senin & Kamis**:
  - Freedom (Mondstadt), Prosperity (Liyue), Transience (Inazuma), Admonition (Sumeru), Equity (Fontaine), Contention (Natlan).
- **Selasa & Jumat**:
  - Resistance, Diligence, Elegance, Ingenuity, Justice, Kindling.
- **Rabu & Sabtu**:
  - Ballad, Gold, Light, Praxis, Order, Conflict.
- **Minggu**:
  - Seluruh domain terbuka bebas dipilih pemain.

### FR-FS-003: Highlight Karakter Relevan
- Kalender secara otomatis membaca karakter yang berada di kolom kanban *Leveling*, *Talents*, atau *Gear*.
- Bila buku talenta karakter tersebut buka hari ini, sistem menampilkan avatar karakter dengan badge *"Buka Hari Ini!"* di widget dashboard utama.

---

## 7. Modul 6: Tabungan Gacha & Pity Planner (FR-GC)

### FR-GC-001: Pelacak Pity Counter
- Input jumlah tarikan (*wishes/searches*) sejak bintang 5 / rank S terakhir:
  - Character Event Wish (Genshin) / Exclusive Channel (ZZZ) [0–90].
  - Weapon Event Wish (Genshin) [0–80] / W-Engine Channel (ZZZ) [0–80].
- Toggle status garansi 50/50: `50/50 Aktif` vs `Garansi Pasti (Guaranteed)`.

### FR-GC-002: Kalkulator Konversi Mata Uang
- Input jumlah mata uang yang dimiliki:
  - Genshin: Primogems, Intertwined Fates, Genesis Crystals.
  - ZZZ: Polychromes, Encrypted Master Tapes, Monochrome.
- Sistem otomatis menghitung total pulls yang setara:
  $$\text{Total Pulls} = \text{Fates} + \left\lfloor \frac{\text{Primogems}}{160} \right\rfloor$$
- Memberikan kalkulasi kekurangan pull menuju target (misal: *"Kurang 34 pull menuju hard pity 90"*).

---

## 8. Modul 7: Eksperimen Backend Go (Gin Framework) (FR-EX)

Modul ini dikembangkan di folder `apps/api-go` sebagai sandbox eksperimen developer:

### FR-EX-001: Optimizer Jalur Farming Resin (Resin Farming Optimizer)
- **Endpoint**: `POST /api/v1/optimize/farming`
- **Fungsi**: Algoritma greedy untuk menyusun jadwal alokasi stamina mingguan yang meminimalkan sisa resin dan memprioritaskan karakter dengan prioritas `Tinggi` pada hari domain terbuka.

### FR-EX-002: Sinkronisasi Showcase UID Publik (Enka.Network Adapter)
- **Endpoint**: `GET /api/v1/sync/showcase/genshin/:uid`
- **Fungsi**: Mengambil data karakter yang dipajang di showcase profil in-game pemain melalui publik API Enka.Network, membaca level, talenta, dan set artifact terpasang secara otomatis tanpa perlu login atau password game.

### FR-EX-003: Health Check & Kinerja Concurrency
- **Endpoint**: `GET /api/v1/health`
- **Fungsi**: Uji throughput dan latensi server Go Gin terhadap beban konkurensi tinggi.

---

## 9. Modul 8: Manajemen Data & Portabilitas (FR-DM)

### FR-DM-001: Penyimpanan Local-First (IndexedDB / LocalStorage)
- Seluruh data kanban, kartu, stamina, dan pengaturan tersimpan secara lokal di browser klien.
- Sistem dapat beroperasi 100% tanpa internet setelah aset awal dimuat (PWA-ready).

### FR-DM-002: Ekspor Berkas JSON (Backup)
- Pengguna dapat mengunduh snapshot data lengkap dalam satu berkas `hoyokanban-data-<tanggal>.json`.

### FR-DM-003: Impor Berkas JSON (Restore)
- Pengguna dapat mengunggah berkas backup JSON untuk memulihkan atau memindahkan data ke perangkat lain (misal dari Laptop ke Smartphone).
- Disertai validasi schema untuk mencegah *corrupted data*.

### FR-DM-004: Muat Data Sampel (Load Demo Data)
- Pengguna baru dapat menekan tombol "Muat Data Contoh" yang langsung mengisi kartu Genshin (misal: Raiden Shogun, Furina, Mualani) dan ZZZ (misal: Ellen Joe, Jane Doe, Zhu Yuan) ke papan kanban.

---

## 10. Matriks Prioritas Kebutuhan (MoSCoW)

| Kebutuhan | Kode FR | Prioritas | Alasan |
|---|---|---|---|
| Papan Kanban Drag-and-Drop | FR-KB-001..004 | **Must Have** | Nilai inti produk sebagai pelacak alur kerja visual. |
| Katalog Karakter Genshin & ZZZ | FR-CH-001..003 | **Must Have** | Fondasi data karakter dan target level/skill. |
| Kalkulator Defisit Material | FR-MC-001..003 | **Must Have** | Menghilangkan kebutuhan menghitung manual. |
| Stamina Hub (Resin & Battery Timer) | FR-ST-001..002 | **Must Have** | Mencegah stamina capping. |
| Local-First Storage & JSON Backup | FR-DM-001..003 | **Must Have** | Menjamin aplikasi dapat dihosting di Vercel tanpa database server berbayar. |
| Kalender Rotasi Farming Harian | FR-FS-001..003 | **Should Have** | Memandu pemain fokus pada hari domain yang tepat. |
| Checklist Harian & Mingguan | FR-ST-003..004 | **Should Have** | Pengingat rutinitas harian & mingguan. |
| Kalkulator Gacha & Pity Planner | FR-GC-001..002 | **Should Have** | Membantu strategi menabung primogem/polychrome. |
| Backend Go (Gin) Sandbox & Optimizer | FR-EX-001..003 | **Could Have** | Eksperimen developer untuk optimasi algoritma dan showcase fetcher. |
| Sync Showcase Otomatis via UID | FR-EX-002 | **Could Have** | Kemudahan impor build in-game otomatis. |
