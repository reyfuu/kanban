# SIGAP — Penjelasan Sederhana
## Dibaca 15 menit, tanpa istilah rumit

> Dokumen ini sengaja ditulis sesederhana mungkin. Kalau setelah membaca ini Anda ingin rinciannya, lanjut ke [11-ALUR-SISTEM.md](11-ALUR-SISTEM.md).

---

## 1. SIGAP itu apa, dalam satu paragraf

Bayangkan sebuah perusahaan sekuritas dengan 1.000 karyawan dan 50 aplikasi komputer. Setiap tahun datang auditor dan bertanya tiga hal yang selalu sama:

1. *"Tunjukkan bukti bahwa aturan kalian dijalankan."*
2. *"Siapa saja yang bisa membuka aplikasi penting kalian, dan siapa yang mengizinkannya?"*
3. *"Mana aturan tertulisnya, dan apakah karyawan tahu?"*

Selama ini jawabannya dikumpulkan lewat email dan file Excel, dan setiap tahun dikumpulkan ulang dari nol. **SIGAP adalah tempat menyimpan jawaban ketiga pertanyaan itu supaya tidak perlu dikumpulkan ulang.**

---

## 2. Perumpamaan sederhana

Bayangkan SIGAP sebagai **gedung sekolah dengan tiga ruangan**:

```mermaid
flowchart TD
    G["🏫 GEDUNG SIGAP"] --> A
    G --> B
    G --> C

    A["📁 RUANG ARSIP<br/>Modul A"]
    B["🔑 RUANG KUNCI<br/>Modul B"]
    C["📖 RUANG ATURAN<br/>Modul C"]

    A --> A1["Menyimpan semua bukti.<br/>Kalau pemeriksa datang,<br/>ambil dari sini."]
    B --> B1["Mencatat siapa pegang kunci<br/>ruangan apa. Tiap 6 bulan<br/>dicek: masih perlu?"]
    C --> C1["Menyimpan buku aturan.<br/>Karyawan cari di sini<br/>kalau bingung."]
```

Yang membuatnya berguna: **ketiga ruangan ini terhubung.** Hasil pengecekan kunci di Ruang Kunci langsung dikirim ke Ruang Arsip sebagai bukti. Buku aturan di Ruang Aturan dipakai sebagai penjelasan di Ruang Arsip. Jadi satu pekerjaan dipakai tiga kali.

---

## 3. Siapa saja orang di dalamnya

Ada 13 jenis orang. Jangan hafal semuanya. Cukup pahami bahwa **semua orang adalah Karyawan dulu**, lalu sebagian orang dapat tugas tambahan.

```mermaid
flowchart TD
    A["👤 Semua orang<br/>= KARYAWAN"] --> B["Sebagian dapat tugas tambahan"]
    B --> C["Yang mengurus KUNCI"]
    B --> D["Yang mengurus ARSIP"]
    B --> E["Yang mengurus ATURAN"]
    B --> F["Yang MENGAWASI"]

    C --> C1["Petugas Keamanan TI"]
    C --> C2["Pemilik Aplikasi"]
    C --> C3["Manajer / Atasan"]

    D --> D1["Auditor Internal"]
    D --> D2["Kepala Auditor"]
    D --> D3["Petugas Bukti"]
    D --> D4["Auditor Luar"]

    E --> E1["Penulis Dokumen"]
    E --> E2["Pengesah Dokumen"]

    F --> F1["Petugas Kepatuhan"]
    F --> F2["Direksi"]
    F --> F3["Admin Sistem"]
```

### Tabel semua peran

| Peran | Sebutan di sistem | Tugasnya | Ibaratnya di sekolah |
|---|---|---|---|
| Karyawan | `EMPLOYEE` | Baca aturan, nyatakan sudah baca | Murid |
| Manajer Lini | `LINE_MANAGER` | Periksa akses anak buahnya | Ketua kelas |
| Petugas Keamanan TI | `SEC_OFFICER` | Atur pengecekan akses seluruh perusahaan | Kepala satpam |
| Pemilik Aplikasi | `APP_OWNER` | Menjaga satu aplikasi, kasih data, tanda tangan hasil | Penjaga satu ruangan |
| Auditor Internal | `AUDITOR_INT` | Memeriksa dan minta bukti | Pemeriksa dari dalam |
| Kepala Auditor | `AUDIT_LEAD` | Sama, plus menyetujui dan menutup temuan | Kepala pemeriksa |
| Auditor Eksternal | `AUDITOR_EXT` | Lihat bukti tertentu saja, sementara | Tamu pemeriksa |
| Petugas Bukti | `EVIDENCE_PIC` | Mengumpulkan bukti untuk unitnya | Yang disuruh cari berkas |
| Penulis Dokumen | `DOC_AUTHOR` | Menulis aturan baru | Penulis buku aturan |
| Pengesah Dokumen | `DOC_APPROVER` | Menyetujui aturan agar berlaku | Kepala sekolah tanda tangan |
| Petugas Kepatuhan | `COMPLIANCE` | Mengawasi semuanya | Pengawas |
| Direksi | `EXECUTIVE` | Lihat ringkasan saja | Pemilik sekolah |
| Admin Sistem | `SYS_ADMIN` | Urus teknis, kasih peran ke orang | Tukang listrik |

**Satu aturan penting:** Admin Sistem **tidak boleh** menyetujui bukti, tanda tangan hasil pemeriksaan, atau mengesahkan aturan. Dia hanya urus mesin. Ini disengaja supaya orang yang punya kuasa teknis tidak bisa sekaligus punya kuasa memutuskan.

---

## 4. Cara masuk ke SIGAP

```mermaid
flowchart LR
    A["Buka SIGAP"] --> B["Masukkan username<br/>dan password kantor"]
    B --> C["Sistem tanya ke<br/>komputer pusat kantor:<br/>'orang ini benar karyawan?'"]
    C --> D{"Benar?"}
    D -->|Tidak| E["❌ Ditolak"]
    D -->|Ya| F["✅ Masuk"]
    F --> G["Halaman Beranda muncul,<br/>berisi tugas Anda saja"]
```

**Tidak ada pendaftaran.** Anda tidak perlu bikin akun. Password yang dipakai adalah password kantor yang sudah Anda punya. SIGAP bahkan tidak menyimpan password Anda sama sekali; dia hanya bertanya ke komputer pusat kantor.

---

## 5. Halaman pertama: Beranda

Begitu masuk, Anda melihat satu halaman yang menjawab satu pertanyaan: **apa yang harus saya kerjakan hari ini?**

```
┌──────────────────────────────────────────────────┐
│  Selamat pagi, Sari            Rabu, 27 Agu 2026 │
│                                                  │
│    ┌───────┐   ┌───────┐   ┌───────┐             │
│    │   3   │   │  14   │   │   6   │             │
│    │TERLEWAT│   │ TOTAL │   │MINGGU │             │
│    └───────┘   └───────┘   └───────┘             │
│                                                  │
│  Tugas Saya                                      │
│  • Permintaan bukti audit      7   2 terlewat  › │
│  • Review hak akses           47   s.d. 15 Sep › │
│  • Dokumen menunggu setujui    2   1 terlewat  › │
│  • Pernyataan sudah baca       1   s.d. 30 Sep › │
└──────────────────────────────────────────────────┘
```

Isinya berbeda untuk tiap orang, karena hanya menampilkan tugas milik Anda.

---

## 6. Panduan per orang: apa yang saya lakukan?

Cari peran Anda, ikuti langkahnya.

### 6.1 Saya Karyawan biasa

Anda cuma punya dua hal.

```mermaid
flowchart TD
    A["👤 Karyawan"] --> B["1️⃣ Cari aturan<br/>saat bingung"]
    A --> C["2️⃣ Nyatakan sudah baca<br/>aturan penting"]

    B --> B1["Tekan Ctrl+K<br/>di halaman mana pun"]
    B1 --> B2["Ketik pertanyaan pakai<br/>bahasa sehari-hari, misalnya:<br/>'boleh nggak terima hadiah nasabah?'"]
    B2 --> B3["Sistem cari di semua<br/>buku aturan perusahaan"]
    B3 --> B4["Muncul jawaban<br/>+ tulisan 'sumbernya: SOP X pasal 5'"]
    B4 --> B5["Klik sumber → dokumen terbuka<br/>tepat di bagian itu"]

    C --> C1["Muncul tugas di Beranda"]
    C1 --> C2["Buka dokumen"]
    C2 --> C3["Baca sampai bawah<br/>tombol baru aktif kalau sudah"]
    C3 --> C4["Klik 'Saya sudah membaca'"]
    C4 --> C5["Tercatat: nama Anda, jam,<br/>dan versi dokumennya"]
```

**Kenapa tombolnya baru aktif setelah baca sampai bawah?** Supaya pernyataan itu ada artinya. Kalau tombolnya bisa langsung diklik, semua orang akan klik tanpa baca.

---

### 6.2 Saya Manajer / Atasan

Tugas Anda muncul dua kali setahun: **memeriksa akses anak buah**.

```mermaid
flowchart TD
    A["📧 Dapat notifikasi:<br/>'Ada 47 akses perlu Anda periksa'"] --> B["Buka menu Review Saya"]
    B --> C["Muncul daftar. Contoh satu baris:<br/>Budi · Aplikasi Trading · peran 'APPROVE_ORDER'"]
    C --> D["Klik untuk lihat penjelasan"]
    D --> E["Sistem tunjukkan:<br/>• Artinya apa dalam bahasa biasa:<br/>  'bisa menyetujui order nasabah'<br/>• Terakhir dipakai kapan<br/>• Ada tanda bahaya atau tidak<br/>• Keputusan Anda 6 bulan lalu apa"]
    E --> F{"Menurut Anda?"}

    F -->|"Masih perlu"| G["Klik PERTAHANKAN"]
    F -->|"Sudah tidak perlu"| H["Klik CABUT<br/>+ tulis alasan"]
    F -->|"Kebanyakan"| I["Klik UBAH<br/>+ tulis alasan"]
    F -->|"Bukan urusan saya"| J["Klik ALIHKAN<br/>+ pilih orang lain"]

    G --> K{"Akses ini<br/>berbahaya?"}
    K -->|Ya| L["Tetap harus tulis alasan"]
    K -->|Tidak| M["Langsung tersimpan"]
    H & I & J & L --> M

    M --> N{"Semua 47<br/>sudah diputuskan?"}
    N -->|Belum| C
    N -->|Ya| O["Klik TANDA TANGAN"]
    O --> P["Masukkan password lagi<br/>untuk memastikan ini benar Anda"]
    P --> Q["✅ Selesai. Tidak bisa diubah lagi."]
```

**Tiga hal yang sering ditanyakan:**

| Pertanyaan | Jawaban |
|---|---|
| Boleh saya klik "Pertahankan" untuk semua sekaligus? | Boleh, tapi hanya untuk yang tidak berbahaya, maksimal 50 sekaligus. Yang berbahaya harus satu per satu. |
| Kalau saya asal klik cepat? | Sistem menghitung kecepatan Anda. Kalau terlalu cepat, tidak diblokir, tapi ditandai dan dilihat pemeriksa. |
| Boleh saya periksa akses saya sendiri? | Tidak boleh. Otomatis dilempar ke atasan Anda. |

**Kenapa tidak ada pilihan yang tercentang duluan?** Karena kalau ada, hampir semua orang akan menerimanya begitu saja, dan pengecekan ini jadi tidak ada gunanya.

---

### 6.3 Saya Pemilik Aplikasi

Anda penjaga satu aplikasi. Tugas Anda tiga.

```mermaid
flowchart TD
    A["🔑 Pemilik Aplikasi"] --> B["1️⃣ Jelaskan arti tiap akses"]
    A --> C["2️⃣ Kirim daftar pengguna"]
    A --> D["3️⃣ Tanda tangan hasil"]

    B --> B1["Sistem tunjukkan kode teknis<br/>seperti 'FIN_APPR_L2'"]
    B1 --> B2["Anda tulis artinya:<br/>'bisa menyetujui pengeluaran<br/>sampai 500 juta'"]
    B2 --> B3["Ini penting! Manajer tidak<br/>paham kode teknis. Tanpa ini,<br/>keputusan mereka cuma tebakan."]

    C --> C1{"Aplikasi Anda bisa<br/>tersambung otomatis?"}
    C1 -->|Bisa| C2["Sistem tarik sendiri<br/>sesuai jadwal.<br/>Anda tidak perlu apa-apa. ✅"]
    C1 -->|Tidak| C3["Anda unduh templat Excel"]
    C3 --> C4["Isi dan unggah kembali"]
    C4 --> C5["Sistem periksa dulu,<br/>tunjukkan baris yang bermasalah"]
    C5 --> C6{"Jumlahnya turun drastis<br/>dari bulan lalu?"}
    C6 -->|"turun >30%"| C7["⚠️ Sistem tanya:<br/>'Yakin? Biasanya 500 orang,<br/>sekarang cuma 200.'"]
    C6 -->|Wajar| C8["Tersimpan ✅"]
    C7 --> C8

    D --> D1["Setelah semua akses<br/>aplikasi Anda diperiksa"]
    D1 --> D2["Anda tanda tangan<br/>+ masukkan password"]
```

**Kenapa sistem curiga saat jumlah turun drastis?** Karena biasanya itu tanda file Excel-nya terpotong saat diekspor. Kalau diterima diam-diam, ratusan akses hilang dari pemeriksaan tanpa ada yang sadar.

---

### 6.4 Saya Petugas Keamanan TI

Anda yang mengatur seluruh pengecekan akses.

```mermaid
flowchart TD
    A["🛡️ Petugas Keamanan TI"] --> B["Sebelum mulai"]
    A --> C["Saat berjalan"]
    A --> D["Setelah selesai"]

    B --> B1["Daftarkan semua aplikasi:<br/>namanya, siapa pemiliknya,<br/>seberapa penting"]
    B1 --> B2["Sambungkan yang bisa<br/>disambung otomatis"]

    C --> C1["Buat 'kampanye' =<br/>satu periode pengecekan"]
    C1 --> C2["Pilih aplikasi mana saja<br/>yang mau dicek"]
    C2 --> C3["Pilih siapa yang memeriksa:<br/>atasan langsung? pemilik aplikasi?<br/>atau dua-duanya?"]
    C3 --> C4["Lihat PRATINJAU dulu — wajib"]
    C4 --> C5{"Sistem beri peringatan?"}
    C5 -->|"Data sudah basi<br/>lebih dari 7 hari"| C6["Tarik data baru dulu"]
    C6 --> C4
    C5 -->|"Terlalu banyak akses<br/>tidak tahu siapa pemiliknya"| C7["Perbaiki data kepegawaian dulu"]
    C7 --> C4
    C5 -->|Aman| C8["🚀 LUNCURKAN"]
    C8 --> C9["Pantau: siapa sudah kerja,<br/>siapa belum. Tagih yang telat."]

    D --> D1["Pantau tiket pencabutan<br/>sampai terbukti tuntas"]
```

**Kenapa pratinjau wajib dilihat?** Karena kalau salah pilih, 38 orang sekaligus terganggu, dan susah dibatalkan setelah jalan.

---

### 6.5 Saya Petugas Bukti

Ada auditor minta bukti, Anda yang menyediakan.

```mermaid
flowchart TD
    A["📧 Notifikasi: 'Tolong kirim bukti<br/>bahwa backup dijalankan Juli 2026'"] --> B["Buka Permintaan Bukti Saya"]
    B --> C["💡 Sistem duluan menyarankan:<br/>'Bukti serupa sudah pernah ada,<br/>diunggah Juni lalu. Pakai ini?'"]
    C --> D{"Cocok?"}
    D -->|"Ya, dan periodenya pas"| E["Klik pakai — selesai dalam 5 detik ✅"]
    D -->|"Periodenya beda"| F["❌ Sistem tolak otomatis<br/>Bukti Juni tidak bisa untuk Juli"]
    D -->|"Belum ada"| G["Unggah file baru"]
    F --> G
    G --> H["Sistem pindai virus<br/>di latar belakang.<br/>Anda tidak perlu menunggu."]
    H --> I["Kirim ke auditor"]
    E --> I
    I --> J{"Auditor menilai"}
    J -->|"Kurang jelas"| K["Dikembalikan + alasan"]
    K --> B
    J -->|"Cukup"| L["✅ Diterima"]
```

**Kenapa saran muncul sebelum tombol unggah?** Karena kalau tombol unggah yang paling menonjol, semua orang akan mengunggah ulang file yang sebenarnya sudah ada. Tujuan utama sistem ini justru supaya tidak ada pekerjaan ganda.

---

### 6.6 Saya Auditor

```mermaid
flowchart TD
    A["🔍 Auditor"] --> B["Buat pemeriksaan baru"]
    B --> C{"Ada templat<br/>dari tahun lalu?"}
    C -->|Ya| D["Daftar permintaan<br/>terisi otomatis"]
    C -->|Tidak| E["Pilih hal-hal<br/>yang mau diperiksa"]
    D & E --> F["Tentukan siapa yang<br/>menyediakan + kapan tenggatnya"]
    F --> G["Terbitkan"]
    G --> H["Tiap orang dapat notifikasi<br/>berisi tugasnya sendiri saja"]
    H --> I["Bukti berdatangan"]
    I --> J{"Menilai"}
    J -->|Kurang| K["Tolak + alasan"]
    J -->|"Ada yang mau ditanya"| L["Minta penjelasan"]
    J -->|Cukup| M["Terima"]
    K & L --> I
    M --> N["Angka kesiapan naik sendiri"]
    N --> O["Semua lengkap → lanjut buat laporan"]
```

---

### 6.7 Saya Penulis / Pengesah Dokumen

```mermaid
flowchart TD
    A["✍️ Penulis buat draf"] --> B["Isi judul, unit pemilik,<br/>dan TINGKAT KERAHASIAAN<br/>(wajib, tidak bisa dilewat)"]
    B --> C["Tulis isi atau unggah file"]
    C --> D["Kirim untuk ditelaah"]
    D --> E["Penelaah baca"]
    E --> F{"Bagaimana?"}
    F -->|"Perlu diperbaiki"| G["Kembali ke penulis + komentar"]
    G --> C
    F -->|Setuju| H["Naik ke pengesah"]
    H --> I["✅ Pengesah tanda tangan<br/>+ masukkan password"]
    I --> J["Status: DISAHKAN"]
    J --> K["Menunggu tanggal berlaku"]
    K --> L["Tanggal tiba → otomatis BERLAKU<br/>versi lama jadi 'sudah diganti'"]
    L --> M["Otomatis bisa dicari<br/>lewat Ctrl+K"]
    L --> N["Notifikasi ke unit terkait"]
    L --> O["Tugas 'nyatakan sudah baca'<br/>dibuat untuk yang wajib"]
```

**Kenapa kerahasiaan wajib diisi di awal?** Karena itu menentukan siapa yang boleh baca. Kalau diisi belakangan, dokumen sempat berada di sistem tanpa penjaga.

---

## 7. Bagian yang paling sering ditanya: tiket pencabutan

Ini bagian paling penting dari seluruh sistem, jadi dijelaskan pelan-pelan.

### Ceritanya begini

```mermaid
flowchart TD
    A["Bu Sari, manajer, memeriksa akses.<br/>Dia lihat: Budi sudah pindah divisi,<br/>tapi masih bisa buka Aplikasi Trading."] --> B["Bu Sari klik CABUT<br/>+ tulis: 'Budi pindah ke HRD'"]
    B --> C["Bu Sari selesaikan semua item,<br/>lalu TANDA TANGAN"]
    C --> D["🎫 Otomatis muncul surat perintah<br/>untuk Pak Andi, petugas TI:<br/>'Tolong cabut akses Budi'"]
    D --> E["📧 Pak Andi dapat notifikasi.<br/>Batas waktu: 5 hari kerja."]
    E --> F["Pak Andi masuk ke Aplikasi Trading,<br/>hapus akses Budi di sana"]
    F --> G["Pak Andi klik 'Sudah saya kerjakan'"]
    G --> H["Status berubah jadi<br/>MENUNGGU PEMBUKTIAN"]
    H --> I["❗ Tidak ada tombol 'Tutup'.<br/>Pak Andi tidak bisa menutup sendiri."]
    I --> J["Minggu depan, sistem tarik lagi<br/>daftar pengguna Aplikasi Trading"]
    J --> K{"Nama Budi masih ada?"}
    K -->|"Masih ada 😬"| L["❌ GAGAL DIBUKTIKAN<br/>Lapor ke atasan Pak Andi"]
    L --> F
    K -->|"Sudah hilang 🎉"| M["✅ TERBUKTI SELESAI"]
```

### Kenapa harus serumit ini?

Bayangkan Anda menyuruh adik membereskan kamar.

| Cara | Hasilnya |
|---|---|
| ❌ Adik bilang "sudah beres", Anda percaya | Kamar mungkin masih berantakan |
| ✅ Anda lihat sendiri kamarnya minggu depan | Anda tahu pasti |

SIGAP memilih cara kedua. **Petugas boleh bilang sudah selesai, tapi hanya data dari aplikasi asli yang bisa membuktikan.** Ini satu-satunya alasan sistem ini lebih berharga daripada file Excel.

### Kalau ternyata memang tidak bisa dicabut?

Ada jalan keluar resmi, tapi harus disetujui dua orang:

```mermaid
flowchart LR
    A["Ternyata akses ini<br/>memang tidak bisa dicabut"] --> B["Ajukan pengecualian"]
    B --> C["Harus disetujui:<br/>Petugas Keamanan TI<br/>DAN Pemilik Aplikasi"]
    C --> D["Wajib tulis:<br/>• alasannya apa<br/>• pengaman penggantinya apa<br/>• kapan mau ditinjau lagi"]
    D --> E["Tercatat permanen<br/>dan muncul di laporan"]
```

Jadi jalan keluarnya ada, tapi meninggalkan jejak. Tidak bisa diam-diam.

---

## 8. Di mana AI-nya, dan apakah berbahaya?

Ada 6 asisten AI di dalam SIGAP. Aturannya cuma satu, dan itu mutlak:

```mermaid
flowchart TD
    A["🤖 AI boleh MEMBACA data"] --> B["AI membuat USULAN"]
    B --> C["Manusia baca usulannya"]
    C --> D{"Setuju?"}
    D -->|Tidak| E["Usulan dibuang.<br/>Tidak ada yang berubah."]
    D -->|Ya| F["Baru jadi data.<br/>Tercatat atas nama MANUSIA<br/>yang menyetujui, bukan AI."]

    G["🚫 AI TIDAK PERNAH<br/>boleh mengubah data langsung"]
```

Contoh nyata: AI bisa membantu Pemilik Aplikasi menulis penjelasan "FIN_APPR_L2 artinya bisa menyetujui pengeluaran sampai 500 juta". Tapi kalimat itu baru masuk sistem setelah Pemilik Aplikasi membacanya dan menekan tombol setuju. Dan yang tercatat sebagai penulis adalah Pemilik Aplikasi, bukan AI.

**Satu aturan tambahan:** AI hanya bisa melihat data yang boleh dilihat orang yang bertanya. Kalau Anda tidak boleh membaca dokumen rahasia, AI juga tidak akan menceritakannya kepada Anda.

---

## 9. Ringkasan satu halaman

### Yang perlu diingat tentang data

| Pertanyaan | Jawaban |
|---|---|
| Siapa mendaftarkan saya? | Tidak ada. Akun muncul sendiri saat Anda login pertama kali pakai password kantor. |
| Data akses dari mana? | Ditarik otomatis dari aplikasi, atau diunggah Pemilik Aplikasi lewat Excel. |
| Data atasan-bawahan dari mana? | Dari data kepegawaian. Ini yang menentukan siapa memeriksa siapa. |
| Daftar yang harus saya periksa dibuat siapa? | Tidak dibuat manual. Muncul sendiri dari data yang ditarik. |

### Yang perlu diingat tentang kerja

| Peran | Frekuensi | Kerjanya |
|---|---|---|
| Karyawan | Sesekali | Cari aturan, nyatakan sudah baca |
| Manajer | 2× setahun | Periksa akses anak buah, tanda tangan |
| Pemilik Aplikasi | 2× setahun | Kirim data, jelaskan arti akses, tanda tangan |
| Petugas Bukti | Saat ada audit | Sediakan bukti |
| Auditor | Saat audit | Minta dan nilai bukti |
| Petugas Keamanan TI | Terus-menerus | Atur dan pantau |

### Lima aturan yang menjelaskan hampir semuanya

1. **Data yang sudah ditarik tidak bisa diedit.** Kalau salah, tarik ulang. Ini supaya pembuktian bisa dipercaya.
2. **Tidak ada jawaban yang tercentang duluan.** Kalau ada, orang akan asal setuju.
3. **Bilang "sudah" bukan berarti sudah.** Harus terbukti dari data aplikasi aslinya.
4. **Satu bukti dipakai berkali-kali.** Kumpulkan sekali, pakai untuk banyak pemeriksaan.
5. **AI cuma mengusulkan.** Manusia yang memutuskan, dan namanya yang tercatat.

---

## 10. Mau coba sendiri?

Di lingkungan pengembangan sudah tersedia akun contoh. Semua memakai kata sandi `demo`.

| Kalau ingin merasakan jadi | Masuk sebagai | Yang akan Anda lihat |
|---|---|---|
| Karyawan biasa | `putri.handayani` | Hanya pencarian aturan dan tugas "sudah baca". Tidak ada menu lain. |
| Manajer yang memeriksa akses | `fajar.nugroho` | Daftar akses anak buah, termasuk milik Putri |
| Pemilik aplikasi | `agus.santoso` | Registri aplikasi, unggah data, sign-off |
| Petugas Keamanan TI | `rina.kusuma` | Penyusun kampanye dan pelacak tiket pencabutan |
| Petugas Bukti | `joko.susilo` | Permintaan bukti yang harus dipenuhi |
| Auditor | `sari.dewi` | Penugasan audit dan penelaahan bukti |
| Penulis aturan | `hendra.wijaya` | Menyusun dokumen |
| Yang mengesahkan aturan | `bayu.pratama` | Menyetujui dokumen agar berlaku |
| Direksi | `direktur.utama` | Ringkasan saja, tanpa detail operasional |
| Auditor dari luar | `budi.harjono` | Akses sangat terbatas, dan otomatis mati setelah 180 hari |

**Coba ini untuk memahami perbedaan peran:** masuk sebagai `putri.handayani`, lihat betapa sedikit menunya. Lalu masuk sebagai `rina.kusuma` dan bandingkan. Keduanya orang yang sama-sama sah, tetapi melihat sistem yang sangat berbeda karena tugasnya berbeda.

Daftar lengkap ada di [DEV-CREDENTIALS.md](DEV-CREDENTIALS.md).

---

## 11. Mau lanjut ke mana?

| Kalau Anda ingin | Baca |
|---|---|
| Gambaran alur lengkap dengan diagram | [11-ALUR-SISTEM.md](11-ALUR-SISTEM.md) |
| Alasan bisnis di balik proyek ini | [01-BRD.md](01-BRD.md) |
| Cerita per pengguna, lengkap | [02-PRD.md](02-PRD.md) |
| Aturan detail sampai ke validasinya | [03-FRD.md](03-FRD.md) |
| Bentuk layarnya seperti apa | [05-UIUX-FLOW.md](05-UIUX-FLOW.md) |
