# SIGAP — Alur Sistem End-to-End
## Dari mana data berasal, siapa yang menyentuhnya, dan ke mana perginya

> **Untuk siapa dokumen ini.** Siapa pun yang perlu memahami SIGAP sebagai satu sistem utuh sebelum menyelam ke requirement per modul. Dokumen ini tidak memperkenalkan aturan baru. Seluruh isinya adalah pembacaan ulang [03-FRD.md](03-FRD.md), [05-UIUX-FLOW.md](05-UIUX-FLOW.md), dan [07-API-CONTRACT.md](07-API-CONTRACT.md) dari sudut pandang perjalanan data, bukan dari sudut pandang daftar fitur.
>
> **Cara membaca.** Bagian 1 menjawab "dari mana semuanya bermula". Bagian 2 sampai 4 menelusuri tiap modul. Bagian 5 menunjukkan titik temu ketiganya — di sanalah nilai produk berada. Bagian 6 menjelaskan posisi agent AI. Bagian 7 adalah tabel rujukan cepat.

---

## 1. Titik Awal: Dari Mana Pengguna dan Data Berasal

Pertanyaan yang paling sering muncul saat pertama membaca dokumentasi SIGAP adalah: *pengguna ini datang dari mana, dan siapa yang mendaftarkannya?*

Jawabannya menentukan cara memahami seluruh sistem: **SIGAP tidak memiliki halaman pendaftaran pengguna.** Tidak ada satu pun formulir tempat seseorang mengetikkan karyawan baru ke dalam sistem. Setiap manusia dan setiap hak akses yang muncul di layar SIGAP berasal dari sistem lain yang sudah lebih dahulu menjadi sumber kebenaran di perusahaan.

### 1.1 Tiga sumber data yang berbeda

```mermaid
flowchart TD
    subgraph LUAR["Di luar SIGAP — sumber kebenaran yang sudah ada"]
        AD["Active Directory<br/>siapa yang boleh masuk"]
        HRIS["Data kepegawaian<br/>siapa bekerja di mana,<br/>siapa atasan siapa,<br/>siapa sudah berhenti"]
        APPS["20–50 aplikasi bisnis<br/>siapa punya akses apa"]
    end

    subgraph DALAM["Di dalam SIGAP"]
        AKUN["Akun SIGAP<br/>FR-X-001 · dibuat saat login pertama"]
        KARY["Direktori karyawan<br/>identitas, unit, jabatan,<br/>status, hierarki atasan"]
        SNAP["Snapshot akses<br/>FR-B-005 · tidak dapat diubah"]
    end

    AD -->|"login LDAP over TLS"| AKUN
    HRIS -->|"sinkronisasi"| KARY
    APPS -->|"konektor FR-B-003<br/>atau unggahan FR-B-004"| SNAP

    AKUN --> PAKAI["Menentukan siapa yang<br/>boleh membuka apa"]
    KARY --> SIAPA["Menentukan reviewer,<br/>atasan, dan PIC"]
    SNAP --> APA["Menentukan objek<br/>yang ditinjau"]
```

Ketiganya menjawab pertanyaan berbeda dan tidak boleh tertukar:

| Sumber | Menjawab | Dipakai untuk |
|---|---|---|
| Active Directory | *Siapa yang boleh masuk ke SIGAP?* | Autentikasi dan pembentukan akun |
| Data kepegawaian | *Siapa orang ini dalam organisasi?* | Menentukan reviewer, atasan, dan penerima eskalasi |
| Snapshot aplikasi | *Akses apa yang dipegang orang ini?* | Objek yang ditinjau pada kampanye |

### 1.2 Bagaimana seorang pengguna mendapat perannya

```mermaid
flowchart TD
    A(["Karyawan membuka SIGAP<br/>pertama kali"]) --> B["Autentikasi ke Active Directory<br/>FR-X-001 · kata sandi tidak pernah disimpan"]
    B --> C{"Kredensial sah?"}
    C -->|Tidak| D["Ditolak · dicatat"]
    C -->|Ya| E{"Akun SIGAP<br/>sudah ada?"}
    E -->|Belum| F["Akun dibuat otomatis<br/>peran dasar EMPLOYEE"]
    E -->|Sudah| G["Muat peran yang dimiliki"]
    F --> G
    G --> H["L-01 Beranda menampilkan<br/>hanya tugas milik orang ini"]

    G -.->|"diberikan terpisah<br/>oleh SYS_ADMIN"| I["Peran tambahan:<br/>SEC_OFFICER · APP_OWNER<br/>LINE_MANAGER · EVIDENCE_PIC<br/>AUDITOR_INT · DOC_AUTHOR · dst"]
    I --> H
```

**Konsekuensi yang perlu dipahami.** Peran `EMPLOYEE` adalah lantai dasar yang dimiliki semua orang. Peran lain adalah tambahan, bukan pengganti. Seorang manajer lini tetap seorang karyawan yang punya kewajiban membaca dokumen, sekaligus punya kewajiban meninjau akses bawahannya. Karena itu L-01 menyatukan seluruh jenis tugas dalam satu daftar, bukan memaksa pengguna berpindah modul untuk mencari pekerjaannya.

### 1.3 Formulir yang benar-benar diisi manusia

Karena data pokok datang dari luar, jumlah formulir isian di SIGAP jauh lebih sedikit daripada yang diduga. Seluruhnya ada delapan:

| Layar | Diisi oleh | Isinya | Requirement |
|---|---|---|---|
| L-13 | `SEC_OFFICER`, `APP_OWNER` | Registri aplikasi dan penjelasan non-teknis tiap hak akses | FR-B-001, FR-B-002 |
| L-14 | `APP_OWNER` | Unggahan data akses untuk aplikasi tanpa konektor | FR-B-004 |
| L-09 | `SEC_OFFICER` | Penyusunan kampanye: cakupan, aturan reviewer, jadwal | FR-B-008, FR-B-009 |
| L-10 | `LINE_MANAGER`, `APP_OWNER` | Keputusan atas tiap item review | FR-B-012 |
| L-11 | `LINE_MANAGER`, `APP_OWNER` | Sign-off kampanye dengan autentikasi ulang | FR-B-015 |
| L-04 | `AUDITOR_INT`, `AUDIT_LEAD` | Penugasan audit dan daftar permintaan bukti | FR-A-001 |
| L-06 | `EVIDENCE_PIC` | Pemenuhan permintaan bukti | FR-A-004 |
| L-12 | Pelaksana tiket | Klaim dan keterangan pelaksanaan — **bukan** penutupan | FR-B-019 |

Semua layar lain adalah pembacaan, penelusuran, pemantauan, atau keputusan atas data yang sudah ada.

---

## 2. Modul B — Access Review: Perjalanan Terpanjang

Modul B dijelaskan lebih dahulu karena rantainya paling panjang dan paling sering menimbulkan pertanyaan "ini datangnya dari mana". Modul ini juga yang memasok bukti otomatis ke Modul A.

### 2.1 Peta besar: enam tahap

```mermaid
flowchart LR
    T1["1 · Persiapan<br/>registri & katalog"] --> T2["2 · Pengambilan data<br/>snapshot"]
    T2 --> T3["3 · Rekonsiliasi<br/>pemetaan & anomali"]
    T3 --> T4["4 · Kampanye<br/>item & keputusan"]
    T4 --> T5["5 · Pencabutan<br/>tiket & verifikasi"]
    T5 --> T6["6 · Paket bukti<br/>masuk Modul A"]
```

### 2.2 Tahap 1 dan 2 — Dari aplikasi bisnis menjadi snapshot

```mermaid
flowchart TD
    subgraph P["Persiapan · dilakukan sekali, dipelihara terus"]
        A1["L-13 · SEC_OFFICER daftarkan aplikasi<br/>FR-B-001"] --> A2["Tetapkan pemilik aplikasi<br/>dan pemilik teknis"]
        A2 --> A3["Tentukan kekritisan<br/>kritis · tinggi · sedang · rendah"]
        A3 --> A4{"Frekuensi review"}
        A4 -->|"kritis / tinggi"| A5["Semesteran"]
        A4 -->|"sedang / rendah"| A6["Tahunan"]
        A2 --> A7["Isi katalog hak akses<br/>FR-B-002"]
        A7 --> A8["Penjelasan non-teknis<br/>tiap hak akses"]
    end

    subgraph M["Pengambilan data · berulang sesuai jadwal"]
        B1{"Aplikasi punya<br/>antarmuka teknis?"}
        B1 -->|Ya| B2["Konektor FR-B-003<br/>LDAP · basis data · REST · SFTP"]
        B2 --> B3["Uji koneksi wajib<br/>sebelum diaktifkan"]
        B3 --> B4["Berjalan sesuai jadwal<br/>kredensial hanya-baca"]
        B4 --> B5{"Berhasil?"}
        B5 -->|"gagal 3× berturut"| B6["Konektor dinonaktifkan<br/>otomatis dan dieskalasi"]
        B5 -->|Ya| SNAP
        B1 -->|Tidak| B7["L-14 · APP_OWNER unggah<br/>CSV atau XLSX bertemplat<br/>FR-B-004"]
        B7 --> B8["Validasi + pratinjau:<br/>baris valid vs bermasalah"]
        B8 --> B9{"Jumlah baris turun<br/>lebih dari 30%?"}
        B9 -->|Ya| B10["Konfirmasi eksplisit diminta<br/>dugaan ekspor tidak lengkap"]
        B10 --> SNAP
        B9 -->|Tidak| SNAP
    end

    A8 -.->|"memberi makna pada<br/>kode teknis di snapshot"| SNAP
    SNAP["SNAPSHOT AKSES · FR-B-005<br/>tidak dapat disunting · punya sidik jari<br/>disimpan minimal 24 versi terakhir"]
    SNAP --> NEXT["Lanjut ke rekonsiliasi"]
```

**Mengapa snapshot tidak dapat disunting.** Koreksi dilakukan dengan pengambilan ulang, bukan dengan perbaikan di tempat. Alasannya muncul jauh di hilir: verifikasi pencabutan pada tahap 5 bergantung penuh pada perbandingan antar-snapshot. Bila snapshot dapat disunting, seseorang dapat membuat tiket tampak tertutup tanpa akses itu benar-benar hilang, dan seluruh nilai modul ini runtuh.

**Mengapa penurunan 30% ditahan.** Ekspor yang terpotong hampir selalu terlihat sebagai penyusutan mendadak. Bila diterima diam-diam, hak akses yang hilang dari berkas juga hilang dari cakupan review, dan luput ditinjau tanpa seorang pun menyadarinya.

### 2.3 Tahap 3 — Menjodohkan akun dengan manusia

Ini titik paling rapuh dalam seluruh rantai, dan paling menentukan kualitas kampanye.

```mermaid
flowchart TD
    A["Snapshot berisi akun aplikasi:<br/>nama akun, kode hak akses"] --> B["Direktori karyawan berisi manusia:<br/>NIK, nama, unit, atasan, status"]
    B --> C["Pemetaan berurutan · FR-B-006"]
    C --> D{"Nomor induk karyawan cocok?"}
    D -->|Ya| OK["Akun terpetakan ke karyawan"]
    D -->|Tidak| E{"Surel cocok?"}
    E -->|Ya| OK
    E -->|Tidak| F{"Nama akun sama dengan<br/>akun Active Directory?"}
    F -->|Ya| OK
    F -->|Tidak| G["Kemiripan nama"]
    G --> H["WAJIB dikonfirmasi manusia<br/>sebelum dianggap sah"]
    H -->|dikonfirmasi| OK
    H -->|"tidak ada yang cocok"| I["Ditandai Tanpa Pemilik"]

    OK --> J["Deteksi anomali · FR-B-007"]
    I --> J
    J --> K["AN-01 Akun aktif milik<br/>karyawan yang sudah berhenti · KRITIS"]
    J --> L["AN-02 Tanpa pemilik"]
    J --> M["AN-03 Tidak aktif melebihi 90 hari"]
    J --> N["AN-04 s.d. AN-08<br/>akses istimewa tanpa dasar, pindah unit,<br/>akun ganda, akun bersama, konflik SoD"]

    K --> O["Notifikasi seketika<br/>tanpa menunggu kampanye"]
    L --> P["Masuk cakupan kampanye<br/>sebagai item bertanda"]
    M --> P
    N --> P
    I -.->|"tanpa karyawan berarti<br/>tanpa atasan"| Q["Item jatuh ke<br/>reviewer cadangan"]
```

**Rantai sebab yang perlu diikuti.** Pemetaan gagal menghasilkan akun Tanpa Pemilik. Akun Tanpa Pemilik tidak punya atasan. Tanpa atasan, aturan penugasan RA-01 tidak dapat bekerja, sehingga itemnya jatuh ke reviewer cadangan. Karena itu FR-B-009 memperingatkan bila lebih dari 10% item jatuh ke reviewer cadangan: angka itu bukan masalah kampanye, melainkan gejala data organisasi yang bermasalah, dan memperbaikinya di hulu jauh lebih murah daripada membebani satu orang dengan ratusan item yang tidak ia kenali.

### 2.4 Tahap 4 — Kampanye dan keputusan

```mermaid
flowchart TD
    A["L-09 · SEC_OFFICER susun kampanye<br/>FR-B-008"] --> B["Pilih aplikasi dan filter cakupan:<br/>unit, jabatan, tingkat risiko,<br/>akses istimewa, jenis anomali"]
    B --> C["Pilih aturan penugasan reviewer<br/>FR-B-009"]
    C --> C1["RA-01 atasan langsung"]
    C --> C2["RA-02 pemilik aplikasi"]
    C --> C3["RA-03 dua lapis"]
    C --> C4["RA-04 pemilik hak akses"]
    C --> C5["RA-05 ditentukan manual"]
    C1 & C2 & C3 & C4 & C5 --> D["Pratinjau · wajib dilihat<br/>jumlah item, jumlah reviewer,<br/>sebaran beban"]
    D --> E{"Ada penghalang?"}
    E -->|"snapshot lebih dari 7 hari"| F["Jalankan konektor<br/>atau minta unggahan"]
    F --> D
    E -->|"cadangan lebih dari 10%"| G["Peringatan:<br/>periksa data organisasi"]
    G --> D
    E -->|Tidak| H["Luncurkan<br/>snapshot DIBEKUKAN untuk kampanye ini"]

    H --> I["Item review terbentuk · FR-B-011<br/>satu item = satu identitas × satu hak akses"]
    I --> J["Reviewer menerima notifikasi"]
    J --> K["L-10 · Review Saya · buka item"]
    K --> L["Konteks yang ditampilkan:<br/>penjelasan non-teknis hak akses,<br/>waktu akses terakhir, penanda risiko,<br/>anomali, konflik SoD,<br/>keputusan siklus sebelumnya"]
    L --> M{"Keputusan · FR-B-012<br/>tidak ada pilihan bawaan"}

    M -->|Pertahankan| N{"Item istimewa<br/>atau berisiko tinggi?"}
    N -->|Ya| O["Alasan wajib<br/>minimal 10 karakter"]
    N -->|Tidak| P["Simpan"]
    M -->|"Cabut"| O
    M -->|"Ubah"| O
    M -->|Alihkan| Q["Pilih penerima + alasan<br/>maksimum 2× lalu naik ke SEC_OFFICER"]
    O --> P
    Q --> P

    P --> R{"Seluruh item<br/>dalam cakupan diputuskan?"}
    R -->|Belum| K
    R -->|Ya| S["L-11 · Sign-off · FR-B-015"]
    S --> T["Autentikasi ulang · FR-X-003"]
    T --> U["Keputusan terkunci<br/>sidik jari kriptografis dibentuk"]

    K -.->|"pola dipantau"| V["Deteksi persetujuan asal-asalan<br/>FR-B-014 · tidak memblokir,<br/>tetapi terlihat oleh audit"]
```

**Dua aturan yang menjadi inti nilai kontrol.** Pertama, tidak ada keputusan yang terpilih otomatis; item tanpa keputusan tetap berstatus belum diputuskan. Kedua, akses istimewa memerlukan alasan bahkan ketika keputusannya Pertahankan. Bila ada nilai bawaan, mayoritas reviewer akan menerimanya begitu saja dan kampanye berubah menjadi ritual administratif tanpa nilai kontrol.

**Mengapa penandaan pola asal-asalan tidak memblokir.** Memblokir akan mendorong reviewer mencari celah, misalnya menunda klik agar melewati ambang waktu. Membuat perilakunya terlihat oleh `AUDIT_LEAD` lebih efektif dan tidak menghambat proses yang sah.

### 2.5 Tahap 5 — Tiket pencabutan dan verifikasinya

Di sinilah pertanyaan "formulir tiket pencabutan ada di mana" terjawab: **formulir itu tidak ada, dan ketiadaannya disengaja.**

```mermaid
flowchart TD
    A["Kampanye ditandatangani"] --> B["Ambil seluruh keputusan<br/>berjenis Cabut atau Ubah"]
    B --> C["Tiket terbentuk otomatis · FR-B-018"]
    C --> D{"Pelaksana ditetapkan<br/>pada konfigurasi aplikasi?"}
    D -->|Ya| E["Tugaskan ke pelaksana itu"]
    D -->|Tidak| F["Tugaskan ke pemilik teknis aplikasi"]
    E & F --> G{"Tingkat kepentingan"}
    G -->|"akses istimewa atau<br/>anomali kritis"| H["SLA 2 hari kerja"]
    G -->|lainnya| I["SLA 5 hari kerja"]
    H & I --> J["Status: Terbuka<br/>notifikasi ke pelaksana"]

    J --> K["Pelaksana klaim<br/>→ Dalam Proses"]
    K --> L["Cabut akses di sistem target<br/>di luar SIGAP"]
    L --> M["Tandai selesai + keterangan<br/>→ Menunggu Verifikasi"]
    M --> N["Tidak ada tombol tutup di L-12.<br/>Menunggu bukti, bukan klaim."]

    N --> O["Snapshot berikutnya masuk<br/>dari konektor atau unggahan"]
    O --> P{"Kombinasi identitas dan hak akses<br/>masih ada pada snapshot? · FR-B-020"}
    P -->|Ya| Q["Gagal Diverifikasi<br/>eskalasi ke SEC_OFFICER + APP_OWNER"]
    Q --> K
    P -->|Tidak| R["Terverifikasi Tertutup"]

    N -->|"tidak ada snapshot baru<br/>selama 30 hari"| S["Tidak Dapat Diverifikasi<br/>dilaporkan ke SEC_OFFICER"]
    J -->|"melewati SLA"| T["Eskalasi ke pelaksana,<br/>APP_OWNER, dan SEC_OFFICER"]
    S & T --> U{"Ajukan pengecualian?"}
    U -->|Ya| V["Persetujuan SEC_OFFICER + APP_OWNER<br/>alasan, kontrol kompensasi,<br/>tanggal peninjauan ulang"]
    V --> W["Dikecualikan"]

    N -.->|"SEC_OFFICER ingin lebih cepat"| X["Verifikasi ad-hoc · FR-B-021<br/>memicu pengambilan data ulang,<br/>bukan memaksa status tertutup"]
    X --> O

    R & W --> Y["Masuk paket bukti kampanye"]
```

**Satu kalimat yang merangkum modul ini.** Pelaksana dapat menyatakan telah mengerjakan, tetapi hanya snapshot yang dapat menyatakan akses benar-benar hilang. Tanpa aturan ini, SIGAP hanya memindahkan spreadsheet ke layar tanpa menambah jaminan apa pun.

### 2.6 Tahap 6 — Paket bukti

```mermaid
flowchart TD
    A["Kampanye berstatus Ditutup"] --> B["Paket bukti dibentuk<br/>otomatis · FR-B-022"]
    B --> C["Isi paket"]
    C --> C1["Ringkasan cakupan dan periode"]
    C --> C2["Metodologi penugasan reviewer"]
    C --> C3["Seluruh keputusan beserta alasannya"]
    C --> C4["Catatan sign-off dan sidik jarinya"]
    C --> C5["Status seluruh tiket dan verifikasinya"]
    C --> C6["Daftar pengecualian dan<br/>kontrol kompensasinya"]
    C --> C7["Anomali yang ditemukan<br/>dan penanganannya"]
    C --> C8["Penandaan reviewer berpola<br/>mencurigakan"]
    C1 & C2 & C3 & C4 & C5 & C6 & C7 & C8 --> D["Berkas PDF dan XLSX<br/>dengan sidik jari kriptografis"]
    D --> E["Otomatis menjadi bukti<br/>di Modul A"]
```

---

## 3. Modul A — Evidence Vault: Siklus Audit

### 3.1 Alur utama

```mermaid
flowchart TD
    A["AUDITOR_INT buat penugasan<br/>L-04"] --> B{"Pakai templat?"}
    B -->|Ya| C["Kontrol dan permintaan<br/>terisi otomatis"]
    B -->|Tidak| D["Pilih kontrol dari<br/>pustaka kontrol"]
    C & D --> E["Susun daftar permintaan bukti"]
    E --> F["Tetapkan PIC dan tenggat<br/>per item"]
    F --> G["Terbitkan"]
    G --> H["EVIDENCE_PIC menerima notifikasi<br/>berisi tugasnya sendiri saja"]

    H --> I["L-06 · Permintaan Bukti Saya"]
    I --> J{"Bukti serupa<br/>sudah pernah ada?"}
    J -->|Ya| K["Pilih dari saran sistem<br/>atau pustaka bukti"]
    K --> L{"Periode cocok?"}
    L -->|Tidak| M["Ditolak sistem<br/>+ opsi minta persetujuan auditor"]
    L -->|Ya| N["Tautkan"]
    M --> N
    J -->|Tidak| O["Unggah berkas baru"]
    O --> P["Pemindaian antivirus<br/>di latar belakang"]
    P --> Q["Sidik jari SHA-256 dihitung"]
    Q --> N
    N --> R["Serahkan"]

    R --> S["Auditor telaah"]
    S --> T{"Memadai?"}
    T -->|Tidak| U["Tolak + alasan"]
    U --> I
    T -->|"perlu penjelasan"| V["Minta informasi tambahan"]
    V --> I
    T -->|Ya| W["Terima"]
    W --> X["Kesiapan penugasan naik otomatis"]
    X --> Y{"Seluruh permintaan selesai?"}
    Y -->|Belum| S
    Y -->|Ya| Z["Penugasan berpindah ke Pelaporan"]
```

**Mengapa saran bukti muncul sebelum tombol unggah.** Bila unggah menjadi jalur utama, penggunaan ulang bukti tidak akan pernah terjadi dan sasaran efisiensi gagal tercapai. Satu bukti yang dikumpulkan sekali seharusnya dapat melayani banyak kontrol dan banyak kerangka ketentuan sekaligus.

### 3.2 Bukti sebagai entitas mandiri

Poin arsitektur yang membedakan SIGAP dari folder berbagi pakai:

```mermaid
flowchart LR
    E["Satu berkas bukti<br/>diunggah sekali"] --> C1["Kontrol POJK"]
    E --> C2["Kontrol ISO 27001"]
    E --> C3["Kontrol COBIT"]
    E --> R1["Permintaan audit internal"]
    E --> R2["Permintaan audit eksternal"]
    E --> R3["Pemeriksaan regulator"]
    E --> H["Chain of custody:<br/>siapa mengunggah, kapan,<br/>siapa menelaah, apa keputusannya"]
    H --> I["Urutan tidak dapat diubah"]
```

Bukti bukan lampiran milik satu permintaan. Ia entitas tersendiri yang ditautkan ke banyak tempat, dengan masa berlaku periode dan riwayat kepemilikan yang melekat padanya.

---

## 4. Modul C — Policy Hub: Aturan dan Kesadarannya

### 4.1 Dari draf sampai berlaku

```mermaid
flowchart TD
    A["DOC_AUTHOR buat draf dokumen"] --> B["Isi metadata<br/>+ klasifikasi WAJIB"]
    B --> C["Unggah berkas atau tulis isi"]
    C --> D["Ajukan penelaahan"]
    D --> E["Penelaah menerima notifikasi"]
    E --> F{"Keputusan"}
    F -->|Kembalikan| G["Komentar kembali ke penyusun"]
    G --> C
    F -->|Setuju| H{"Seluruh penelaah selesai?"}
    H -->|Belum| E
    H -->|Ya| I["Ajukan pengesahan"]
    I --> J["DOC_APPROVER berjenjang"]
    J --> K{"Keputusan"}
    K -->|Tolak| G
    K -->|Sahkan| L["Autentikasi ulang"]
    L --> M{"Ada pengesah berikutnya?"}
    M -->|Ya| J
    M -->|Tidak| N["Status: Disahkan"]
    N --> O["Menunggu tanggal berlaku"]
    O --> P["Tanggal tiba · proses harian"]
    P --> Q["Status: Berlaku<br/>versi lama menjadi Digantikan"]
    Q --> R["Pengindeksan otomatis:<br/>ekstraksi teks → pemenggalan → vektor"]
    R --> S["Dapat ditemukan melalui pencarian"]
    Q --> T["Notifikasi ke unit terkait"]
    Q --> U["Jadwal tinjauan berkala disetel"]
    Q --> V["Tugas pernyataan telah membaca<br/>dibuat bagi yang wajib"]
```

**Klasifikasi wajib diisi di awal, bukan di akhir.** Klasifikasi menentukan siapa yang dapat membaca dokumen dan apakah isinya boleh diproses layanan bahasa eksternal. Menundanya berarti dokumen sempat berada dalam sistem tanpa batas perlakuan yang jelas.

### 4.2 Karyawan mencari aturan

```mermaid
flowchart TD
    A["Karyawan hadapi kasus<br/>tidak biasa"] --> B["Ctrl+K dari halaman mana pun"]
    B --> C["Ketik pertanyaan<br/>dengan bahasa sendiri"]
    C --> D["Pencarian hibrida:<br/>kata kunci + kemiripan makna,<br/>disaring hak akses pengguna"]
    D --> E{"Ada hasil?"}
    E -->|Tidak| F["Saran ejaan dan istilah<br/>+ bidang proses terdekat<br/>+ tawaran bertanya ke unit pemilik"]
    F --> C
    E -->|Ya| G["Tampilkan hasil"]
    G --> H{"Fitur jawaban otomatis aktif?"}
    H -->|Tidak| I["Hanya daftar hasil"]
    H -->|Ya| J{"Gerbang klasifikasi · FR-C-014"}
    J -->|"seluruh sumber<br/>Terbatas atau Rahasia"| K["Keterangan: jawaban otomatis<br/>tidak tersedia untuk materi ini<br/>+ tautan dokumennya"]
    J -->|"sebagian dikecualikan"| L["Jawaban + keterangan bahwa<br/>sebagian sumber tidak disertakan"]
    J -->|Lolos| M["Redaksi data pribadi · FR-C-015"]
    M --> N{"Dasar memadai?"}
    N -->|Tidak| O["Nyatakan tidak menemukan dasar<br/>+ daftar hasil"]
    N -->|Ya| P["Jawaban + rujukan pasal"]
    I & K & L & O & P --> Q["Klik rujukan"]
    Q --> R["Dokumen terbuka tepat pada<br/>bagian yang dirujuk, dengan sorotan"]
    R --> S{"Ada tugas pernyataan<br/>telah membaca?"}
    S -->|Ya| T["Baca sampai akhir<br/>→ tombol pernyataan aktif"]
    S -->|Tidak| U["Selesai"]
    T --> V["Nyatakan telah membaca<br/>tercatat dengan versi dokumen"]
```

**Penolakan karena klasifikasi bukan kegagalan sistem.** Ia keputusan kebijakan dan harus dijelaskan sebagai keputusan, disertai jalan keluar berupa tautan langsung ke dokumennya. Pengguna tetap berhak membaca; yang dibatasi adalah pengiriman isinya ke layanan luar.

---

## 5. Titik Temu: Mengapa Tiga Modul Ini Satu Sistem

Nilai utama SIGAP tidak berada pada salah satu modul, melainkan pada tempat ketiganya bertemu.

```mermaid
flowchart TD
    subgraph B["Modul B · Access Review"]
        B1["Kampanye selesai"] --> B2["Paket bukti kampanye"]
    end

    subgraph C["Modul C · Policy Hub"]
        C1["SOP berlaku"] --> C2["Uraian cara kontrol dijalankan"]
        C3["Catatan pernyataan telah membaca"]
    end

    subgraph A["Modul A · Evidence Vault"]
        A1["Pustaka kontrol<br/>dipetakan ke banyak kerangka"]
        A2["Penyimpanan bukti bersama"]
        A3["Penugasan audit"]
    end

    B2 -->|"otomatis menjadi bukti<br/>tanpa diunggah ulang"| A2
    C2 -->|"dirujuk kertas kerja<br/>sebagai uraian kontrol"| A1
    C3 -->|"bukti bahwa aturan<br/>tersosialisasi"| A2
    A1 -->|"menentukan aplikasi mana<br/>yang wajib direview"| B1
    A2 --> A3
    A3 --> D["Auditor bertanya:<br/>tunjukkan buktinya"]
    D --> E["Jawaban tersedia tanpa<br/>mengumpulkan ulang"]
```

Tiga pertanyaan yang saling menopang:

| Modul | Pertanyaan | Keluarannya menjadi masukan bagi |
|---|---|---|
| A | *Tunjukkan buktinya.* | Menentukan kontrol dan aplikasi yang wajib ditinjau Modul B |
| B | *Siapa punya akses, dan siapa menyetujuinya?* | Paket bukti masuk ke penyimpanan Modul A |
| C | *Mana aturannya, dan apakah orang tahu?* | Uraian kontrol dan catatan pernyataan menjadi bukti di Modul A |

**Satu penyimpanan bukti, bukan tiga.** Inilah alasan arsitekturnya modular monolith, bukan tiga sistem terpisah. Bukti yang dikumpulkan sekali dapat dipetakan ke banyak kontrol dan banyak kerangka ketentuan tanpa penggandaan berkas.

---

## 6. Posisi Agent AI dalam Alur

Agent AI tidak pernah menjadi simpul yang mengubah data pada seluruh diagram di atas. Ia selalu berada di samping alur, bukan di dalamnya.

```mermaid
flowchart TD
    A["Data produksi SIGAP"] -->|"tool baca-saja"| B["Agent menjalankan tugas<br/>AG-1 s.d. AG-6"]
    B --> C["Usulan Agent<br/>bukan data"]
    C --> D["Menunggu telaah manusia berwenang"]
    D --> E{"Keputusan penelaah"}
    E -->|Tolak| F["Usulan berakhir<br/>tidak ada perubahan data"]
    E -->|Terima| G["Menjadi data<br/>tercatat atas nama PENELAAH,<br/>bukan atas nama agent"]
    G --> A

    B -.->|"tidak pernah ada panah ini"| A

    H["Hak akses agent<br/>mewarisi hak pemohon"] --> B
    I["Setiap pernyataan wajib<br/>dapat dipetakan ke potongan sumber"] --> C
```

Enam agent dan letaknya pada alur:

| Agent | Membantu tahap | Usulannya ditelaah oleh |
|---|---|---|
| AG-1 | Pencarian aturan pada Modul C | Penanya, melalui rujukan yang dapat diperiksa |
| AG-2 | Pengisian penjelasan non-teknis hak akses | `APP_OWNER` |
| AG-3 | Penyaringan awal anomali akses | `SEC_OFFICER` |
| AG-4 | Pencocokan bukti yang sudah ada dengan permintaan | `EVIDENCE_PIC` dan auditor |
| AG-5 | Penyusunan draf kertas kerja | `AUDITOR_INT` |
| AG-6 | Pemetaan kontrol ke kerangka ketentuan | `COMPLIANCE` |

**Konsekuensi praktis.** Ketika membaca alur mana pun di dokumen ini, agent dapat mempercepat pengisian sebuah kotak, tetapi tidak pernah menghapus kotak persetujuan manusia yang mengikutinya.

---

## 7. Rujukan Cepat

### 7.1 Pertanyaan yang sering muncul

| Pertanyaan | Jawaban singkat | Rincian |
|---|---|---|
| Pengguna didaftarkan di mana? | Tidak didaftarkan. Akun terbentuk otomatis saat login Active Directory pertama, dengan peran dasar `EMPLOYEE` | §1.2, FR-X-001 |
| Data karyawan dari mana? | Sinkronisasi dari data kepegawaian, termasuk hierarki atasan yang menentukan reviewer | §1.1 |
| Daftar akses aplikasi dari mana? | Konektor terjadwal, atau unggahan berkas bertemplat bila aplikasi tidak punya antarmuka teknis | §2.2, FR-B-003, FR-B-004 |
| Item review dibuat siapa? | Tidak dibuat manual. Terbentuk dari perkalian identitas × hak akses dalam cakupan kampanye | §2.4, FR-B-011 |
| Reviewer ditentukan bagaimana? | Aturan RA-01 s.d. RA-05 pada konfigurasi kampanye, dengan reviewer cadangan sebagai jaring pengaman | §2.4, FR-B-009 |
| Formulir tiket pencabutan di mana? | Tidak ada. Tiket lahir otomatis dari keputusan Cabut atau Ubah yang sudah ditandatangani | §2.5, FR-B-018 |
| Siapa yang menutup tiket? | Bukan manusia. Snapshot berikutnya yang membuktikan akses hilang | §2.5, FR-B-020 |
| Bukti audit dari mana? | Diunggah PIC melalui L-06, dipilih ulang dari pustaka bukti, atau datang otomatis dari paket bukti kampanye Modul B | §3.1, §5 |
| Apakah agent mengubah data? | Tidak pernah. Agent menghasilkan usulan; perubahan tercatat atas nama penelaah manusia | §6 |

### 7.2 Peta dokumen dari sudut pandang alur

| Ingin tahu | Baca |
|---|---|
| Mengapa sistem ini dibangun | [01-BRD.md](01-BRD.md) |
| Untuk siapa dan apa yang dirasakan pengguna | [02-PRD.md](02-PRD.md) |
| Aturan tepatnya, sampai ke tingkat validasi | [03-FRD.md](03-FRD.md) |
| Bagaimana dibangun dan mengapa begitu | [04-TRD.md](04-TRD.md) |
| Bentuk layarnya | [05-UIUX-FLOW.md](05-UIUX-FLOW.md), [06-DESIGN.md](06-DESIGN.md) |
| Bentuk permintaan dan tanggapannya | [07-API-CONTRACT.md](07-API-CONTRACT.md) |
| Batas wewenang agent AI | [08-AGENT-SPEC.md](08-AGENT-SPEC.md), [09-GUARDRAILS.md](09-GUARDRAILS.md) |
| Cara membuktikan semuanya benar | [10-TEST-PLAN.md](10-TEST-PLAN.md) |

### 7.3 Enam aturan yang menjelaskan sebagian besar keputusan rancangan

1. **Snapshot tidak dapat disunting.** Koreksi berarti pengambilan ulang. Verifikasi pencabutan bergantung padanya.
2. **Tidak ada keputusan bawaan.** Item tanpa keputusan tetap belum diputuskan, karena nilai bawaan menghapus nilai kontrolnya.
3. **Klaim bukan bukti.** Pelaksana menyatakan telah mengerjakan; hanya snapshot yang membuktikan.
4. **Bukti adalah entitas mandiri.** Dikumpulkan sekali, ditautkan ke banyak kontrol dan banyak kerangka ketentuan.
5. **Klasifikasi menentukan perlakuan.** Termasuk apakah isi dokumen boleh keluar menuju layanan bahasa eksternal.
6. **Agent hanya mengusulkan.** Setiap perubahan data tercatat atas nama manusia yang menelaahnya.
