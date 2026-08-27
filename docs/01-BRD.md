# BRD — Business Requirements Document
## SIGAP: Sistem Integrasi Governance, Akses, dan Prosedur
### PT Trimegah Sekuritas Indonesia Tbk

| | |
|---|---|
| **Dokumen** | Business Requirements Document (BRD) |
| **Produk** | SIGAP v1.0 |
| **Perusahaan** | PT Trimegah Sekuritas Indonesia Tbk (TRIM) |
| **Versi dokumen** | 1.0 |
| **Tanggal** | 27 Agustus 2026 |
| **Penyusun** | Tim Arsitektur & Solusi TI |
| **Audiens** | Direksi, Direktur Kepatuhan, Kepala SKAI, Kepala Divisi TI, Komite Audit |
| **Status** | Draft untuk pembahasan Steering Committee |
| **Klasifikasi** | Internal |

---

## 1. Ringkasan Eksekutif

Perusahaan menghadapi beban kepatuhan yang meningkat, namun tiga proses pengendalian internal yang paling sering diminta bukti oleh auditor dan regulator masih dikerjakan secara manual: **pengumpulan bukti audit (evidence)**, **review hak akses pengguna lintas aplikasi (User Access Review/UAR)**, dan **pencarian SOP serta kebijakan internal**.

Dampaknya terukur. Setiap siklus audit menghabiskan ratusan jam kerja hanya untuk mengumpulkan dan menyusun ulang bukti yang sebagian besar sudah pernah dikumpulkan sebelumnya. Setiap siklus UAR berjalan di atas spreadsheet yang dikirim melalui email, sehingga sulit dibuktikan kepada auditor bahwa review benar-benar dilakukan oleh pihak yang berwenang dan bahwa pencabutan akses benar-benar dieksekusi. Karyawan tidak menemukan versi SOP yang berlaku, sehingga pelanggaran prosedur terjadi bukan karena niat, tetapi karena ketidaktahuan.

**SIGAP** adalah satu platform internal dengan tiga modul yang berbagi satu penyimpanan bukti (evidence store) bersama:

| Modul | Nama | Fungsi inti |
|---|---|---|
| **A** | **Evidence Vault** | Manajemen bukti untuk audit internal, audit eksternal, pemeriksaan regulator, dan self-assessment |
| **B** | **Access Review** | Kampanye sertifikasi hak akses lintas aplikasi dengan jejak sign-off dan verifikasi pencabutan |
| **C** | **Policy Hub** | Siklus hidup, pencarian cerdas, dan attestation SOP serta kebijakan internal |

Nilai utama SIGAP bukan pada tiga modul itu berdiri sendiri — produk komersial untuk masing-masing sudah tersedia di pasar. Nilainya ada pada **keterhubungan**: hasil kampanye UAR otomatis menjadi bukti kepatuhan untuk kontrol audit; SOP menjadi *control narrative* yang dirujuk kertas kerja auditor; satu bukti yang dikumpulkan sekali dapat dipetakan ke banyak kontrol dan banyak framework sekaligus. Keterhubungan inilah yang hilang jika perusahaan membeli tiga produk terpisah.

**Permintaan keputusan:** persetujuan atas ruang lingkup, anggaran indikatif, dan roadmap tiga fase yang diuraikan dalam dokumen ini.

---

## 2. Latar Belakang & Konteks Regulasi

### 2.1 Kewajiban kelembagaan

PT Trimegah Sekuritas Indonesia Tbk adalah Perusahaan Efek berizin OJK dan Anggota Bursa Efek Indonesia, dengan lini usaha meliputi perdagangan ekuitas, surat utang (*fixed income*), *investment banking*, distribusi reksa dana, pembiayaan transaksi, dan platform perdagangan daring Trima+.

Sebagai Perusahaan Efek yang menjalankan kegiatan Perantara Pedagang Efek (PPE) dan Penjamin Emisi Efek (PEE), perusahaan wajib memiliki fungsi kepatuhan, fungsi manajemen risiko, fungsi audit internal, dan fungsi pengelolaan teknologi informasi yang andal. Ketiga fungsi pengendalian ini menghasilkan permintaan bukti yang berulang dan bertumpuk sepanjang tahun.

Keragaman lini usaha memperbesar beban tersebut: setiap lini memiliki aplikasi, prosedur, dan profil risiko sendiri, sehingga cakupan bukti audit dan cakupan review hak akses lebih luas daripada perusahaan efek yang hanya menjalankan satu lini.

### 2.2 Sumber permintaan bukti dalam satu tahun buku

| Sumber | Frekuensi tipikal | Karakteristik permintaan |
|---|---|---|
| Audit internal (SKAI) | 8–15 penugasan/tahun | Bukti kontrol operasional, IT general control, kepatuhan proses |
| Audit eksternal / KAP | 1–2 siklus/tahun | Bukti pengendalian internal atas pelaporan keuangan |
| Pemeriksaan OJK | Insidental & berkala | Bukti tata kelola, manajemen risiko TI, keamanan siber, kepatuhan |
| Bursa (IDX) / KSEI / KPEI | Berkala | Bukti operasional & pemenuhan ketentuan keanggotaan |
| Self-assessment tata kelola | Tahunan | Bukti pemenuhan tiap parameter penilaian |
| Sertifikasi ISO 27001 (bila ada) | Surveillance tahunan | Bukti kontrol Annex A |
| Audit induk/holding | Tahunan | Bukti selaras kebijakan grup |

Bukti yang diminta oleh sumber-sumber ini sangat beririsan. Bukti yang sama — misalnya daftar pengguna aktif aplikasi core, hasil review hak akses, atau bukti approval perubahan sistem — diminta ulang oleh pihak berbeda dalam format berbeda, dan setiap kali dikumpulkan dari nol.

### 2.3 Matriks pemicu regulasi

Tabel berikut memetakan ketentuan yang relevan ke kapabilitas yang harus disediakan SIGAP. Matriks ini menjadi dasar penentuan ruang lingkup wajib (Must Have).

| Kode | Sumber ketentuan | Substansi yang relevan | Kapabilitas SIGAP |
|---|---|---|---|
| REG-01 | POJK 38/POJK.03/2016 — Penerapan Manajemen Risiko dalam Penggunaan TI | Kewajiban pengendalian internal atas TI, pengelolaan akses pengguna, jejak audit | Modul B (kampanye UAR, jejak sign-off), Audit trail platform |
| REG-02 | POJK 4/POJK.05/2021 — Manajemen Risiko TI bagi LJK Non-Bank | Identifikasi, pengukuran, pengendalian, dan pemantauan risiko TI; dokumentasi kebijakan & prosedur TI | Modul C (siklus hidup kebijakan), Modul A (bukti pemantauan) |
| REG-03 | SEOJK 29/SEOJK.03/2022 — Ketahanan & Keamanan Siber | Identifikasi aset, perlindungan aset, deteksi insiden, dokumentasi & pelaporan | Modul B (inventaris aplikasi & identitas), Modul A (bukti kontrol siber) |
| REG-04 | Ketentuan Perusahaan Efek — fungsi wajib | Independensi fungsi kepatuhan, manajemen risiko, audit internal; pemisahan tugas | Modul B (deteksi konflik pemisahan tugas), RBAC platform |
| REG-05 | ISO/IEC 27001:2022 Annex A — A.5.15 Access Control | Aturan kontrol akses ditetapkan & ditinjau | Modul B |
| REG-06 | ISO/IEC 27001:2022 Annex A — A.5.18 Access Rights | Hak akses ditinjau, diubah, dan dicabut secara berkala | Modul B (kampanye + verifikasi pencabutan) |
| REG-07 | ISO/IEC 27001:2022 Annex A — A.5.36 Compliance with Policies | Kepatuhan terhadap kebijakan ditinjau & dibuktikan | Modul C (attestation), Modul A |
| REG-08 | ISO/IEC 27001:2022 Annex A — A.5.37 Documented Operating Procedures | Prosedur operasional terdokumentasi & tersedia bagi yang membutuhkan | Modul C |
| REG-09 | ISO/IEC 27001:2022 Annex A — A.8.2 Privileged Access Rights | Hak akses istimewa dibatasi & ditinjau lebih ketat | Modul B (penandaan entitlement berisiko tinggi) |
| REG-10 | COBIT 2019 — DSS06, MEA02 | Pengendalian proses bisnis, pemantauan sistem pengendalian internal | Seluruh modul + pelaporan |
| REG-11 | UU 27/2022 — Pelindungan Data Pribadi | Perlindungan data pribadi karyawan & nasabah dalam bukti dan dokumen | Kontrol klasifikasi, redaksi, dan pembatasan egress data |

> **Catatan penyusun.** Nomor dan tahun ketentuan pada REG-01 s.d. REG-04 harus diverifikasi ulang oleh Divisi Kepatuhan terhadap ketentuan terkini yang berlaku bagi Perusahaan Efek sebelum dokumen ini difinalkan. Substansi kewajibannya stabil, penomorannya dapat berubah karena konsolidasi peraturan.

---

## 3. Problem Statement & Biaya Kondisi Saat Ini

Angka pada bagian ini adalah **estimasi kerja (working estimate)** berbasis asumsi yang dinyatakan eksplisit, bukan hasil pengukuran. Angka harus divalidasi melalui *time study* singkat pada satu siklus audit dan satu siklus UAR sebelum anggaran diajukan.

### Asumsi dasar organisasi

| Parameter | Nilai asumsi |
|---|---|
| Jumlah karyawan | 500 orang |
| Jumlah aplikasi dalam ruang lingkup | 30 aplikasi |
| Penugasan audit & assessment per tahun | 12 |
| Siklus UAR per tahun | 2 (semesteran) |
| Biaya rata-rata per jam kerja (fully loaded) | Rp 150.000 |

### 3.1 Masalah A — Pengumpulan bukti audit

**Kondisi saat ini.** Auditor mengirim daftar permintaan bukti (*PBC list*) dalam format Excel melalui email. PIC di tiap unit mencari dokumen di folder bersama atau meminta ekstraksi data ke tim TI, lalu mengirim balik melalui email atau tautan berbagi. Koordinator audit menggabungkan lampiran secara manual ke dalam folder penugasan. Tidak ada penomoran versi, tidak ada bukti kapan dan oleh siapa bukti diserahkan, dan tidak ada cara sistematis mengetahui bahwa bukti serupa sudah pernah diserahkan pada penugasan sebelumnya.

**Akibat yang teramati.**

- Bukti yang identik dikumpulkan berulang untuk penugasan dan framework berbeda.
- Rantai kepemilikan bukti (*chain of custody*) tidak dapat dibuktikan — kelemahan yang serius ketika bukti dipertanyakan keasliannya.
- Auditor mencatat temuan administratif berkategori "bukti tidak dapat disediakan tepat waktu" yang sebenarnya bukan kegagalan kontrol, melainkan kegagalan administrasi.
- Lampiran bukti yang mengandung data pribadi beredar di kotak surat pribadi tanpa kendali retensi.

**Estimasi biaya tahunan.**

| Komponen | Perhitungan | Jam/tahun |
|---|---|---|
| PIC unit memenuhi permintaan bukti | 12 penugasan × 25 item × 2,5 jam | 750 |
| Koordinator audit menagih & merapikan | 12 penugasan × 20 jam | 240 |
| Tim TI mengekstraksi data ad-hoc | 12 penugasan × 10 jam | 120 |
| Pengerjaan ulang karena bukti ditolak/salah versi | 15% dari total di atas | 167 |
| **Total** | | **≈ 1.277 jam** |

Setara **± Rp 192 juta per tahun** dalam bentuk waktu kerja, di luar biaya risiko temuan.

### 3.2 Masalah B — Review hak akses lintas aplikasi

**Kondisi saat ini.** Menjelang siklus review, tim TI Security meminta setiap application owner mengekspor daftar pengguna dan hak aksesnya. Berkas Excel dikirim ke atasan langsung dan/atau pemilik aplikasi untuk ditandai "masih diperlukan" atau "dicabut". Hasilnya dikembalikan lewat email, direkap manual, lalu permintaan pencabutan diteruskan ke tim operasional TI.

**Akibat yang teramati.**

- Bukti sign-off berupa email atau kolom nama yang diketik sendiri — lemah secara audit karena tidak membuktikan identitas penandatangan.
- Tidak ada mekanisme yang memastikan pencabutan benar-benar dieksekusi; verifikasi baru terjadi (kalau terjadi) pada siklus berikutnya.
- Akun milik karyawan yang sudah berhenti (*terminated but active*) dan akun tanpa pemilik (*orphan account*) lolos karena rekonsiliasi terhadap data HR dilakukan manual, kalau dilakukan.
- Reviewer cenderung menyetujui seluruh baris sekaligus (*rubber-stamping*) karena antarmuka spreadsheet tidak menuntut alasan dan tidak menyoroti akses berisiko.
- Konflik pemisahan tugas antar-aplikasi (misalnya satu orang memegang akses input transaksi sekaligus approval settlement) tidak terdeteksi karena datanya tidak pernah dilihat berdampingan.

**Estimasi biaya tahunan.**

| Komponen | Perhitungan | Jam/tahun |
|---|---|---|
| Application owner ekspor & siapkan data | 2 siklus × 30 aplikasi × 3 jam | 180 |
| Reviewer menelaah & memutuskan | 2 siklus × 500 karyawan × 0,2 jam | 200 |
| TI Security merekap & menagih | 2 siklus × 60 jam | 120 |
| Eksekusi & konfirmasi pencabutan | 2 siklus × 25 jam | 50 |
| Penyusunan paket bukti untuk auditor | 2 siklus × 20 jam | 40 |
| **Total** | | **≈ 590 jam** |

Setara **± Rp 89 juta per tahun**. Biaya finansial ini bukan masalah utamanya — **risiko akses tidak sah yang lolos** adalah masalah utamanya, dan risiko itu tidak dapat dihitung dalam jam kerja.

### 3.3 Masalah C — Pencarian SOP & kebijakan internal

**Kondisi saat ini.** Dokumen kebijakan, SOP, memo internal, dan surat edaran tersimpan tersebar di *file server*, portal intranet, lampiran email, dan folder unit kerja. Pencarian mengandalkan nama berkas. Tidak ada penanda versi berlaku, sehingga dokumen kedaluwarsa masih beredar. Tidak ada catatan siapa sudah membaca kebijakan mana.

**Akibat yang teramati.**

- Karyawan bertanya ke rekan atau atasan alih-alih membaca dokumen, sehingga interpretasi prosedur menyebar secara lisan dan tidak konsisten.
- Dokumen versi lama dipakai sebagai acuan kerja.
- Ketika auditor menanyakan "apakah karyawan mengetahui kebijakan ini", perusahaan tidak dapat membuktikannya.
- Tinjauan berkala dokumen terlewat karena tidak ada pengingat otomatis.

**Estimasi biaya tahunan.**

| Komponen | Perhitungan | Jam/tahun |
|---|---|---|
| Waktu karyawan mencari dokumen | 500 orang × 1,5 pencarian/bulan × 12 × 0,25 jam | 2.250 |
| Waktu unit pemilik dokumen menjawab pertanyaan berulang | 15 unit × 2 jam/bulan × 12 | 360 |
| Administrasi versi & distribusi manual | 120 jam | 120 |
| **Total** | | **≈ 2.730 jam** |

Setara **± Rp 410 juta per tahun**. Angka pencarian dokumen bersifat *diffuse* — tersebar tipis ke seluruh karyawan sehingga tidak terasa, tetapi merupakan komponen biaya terbesar dari ketiga masalah.

### 3.4 Rekapitulasi biaya kondisi saat ini

| Masalah | Jam/tahun | Estimasi biaya/tahun |
|---|---|---|
| A — Pengumpulan bukti audit | 1.277 | Rp 192 juta |
| B — Review hak akses | 590 | Rp 89 juta |
| C — Pencarian SOP & kebijakan | 2.730 | Rp 410 juta |
| **Total** | **4.597 jam** | **± Rp 691 juta** |

Di luar angka ini terdapat biaya risiko yang tidak dikuantifikasi: sanksi administratif regulator, temuan berulang, dan kerugian akibat akses tidak sah.

---

## 4. Sasaran Bisnis & Indikator Keberhasilan

Setiap sasaran memiliki kode (`OBJ-xx`) yang dirujuk oleh PRD dan FRD untuk menjaga keterlacakan.

| Kode | Sasaran bisnis | Indikator (KPI) | Baseline | Target 12 bulan pasca-implementasi |
|---|---|---|---|---|
| **OBJ-01** | Memangkas usaha pemenuhan permintaan bukti audit | Rata-rata jam kerja per penugasan audit | 106 jam | ≤ 45 jam (−58%) |
| **OBJ-02** | Menghentikan pengumpulan bukti berulang | *Evidence reuse rate* (bukti dipakai ≥2 kontrol) | ~0% | ≥ 40% |
| **OBJ-03** | Menghilangkan temuan administratif soal bukti | Jumlah temuan berkategori "bukti tidak tersedia/terlambat" | 3–6 per tahun | 0 |
| **OBJ-04** | Mempercepat siklus UAR | Durasi siklus dari pembukaan sampai sign-off penuh | 6–8 minggu | ≤ 10 hari kerja |
| **OBJ-05** | Memastikan pencabutan akses benar-benar tuntas | % item "revoke" terverifikasi tertutup dalam SLA 5 hari kerja | Tidak terukur | ≥ 95% |
| **OBJ-06** | Menutup celah akun berisiko | Jumlah akun *terminated-but-active* pada snapshot bulanan | Tidak terukur | 0 dalam 3 bulan berturut-turut |
| **OBJ-07** | Membuat sign-off dapat dipertahankan secara audit | % keputusan review dengan identitas terverifikasi & alasan tercatat | ~0% | 100% |
| **OBJ-08** | Mempercepat karyawan menemukan aturan yang benar | Waktu rata-rata menemukan jawaban dari pencarian | ~15 menit | ≤ 2 menit |
| **OBJ-09** | Menjamin hanya versi berlaku yang beredar | % pencarian yang mengembalikan dokumen berstatus *Published* & berlaku | Tidak terukur | 100% |
| **OBJ-10** | Membuktikan pemahaman kebijakan | % attestation selesai pada kebijakan wajib dalam 30 hari | Tidak terukur | ≥ 90% |
| **OBJ-11** | Mengendalikan risiko kebocoran dokumen internal | Jumlah dokumen berklasifikasi Terbatas/Rahasia yang keluar ke layanan eksternal | Tidak terkendali | 0 |
| **OBJ-12** | Menyediakan pandangan konsolidasi kepada manajemen | Ketersediaan dasbor kepatuhan *real-time* untuk Direksi & Komite Audit | Tidak ada | Tersedia |

---

## 5. Pemangku Kepentingan

### 5.1 Daftar pemangku kepentingan

| Peran | Unit | Kepentingan utama | Dampak bila proyek gagal |
|---|---|---|---|
| Direktur Kepatuhan | Direksi | Pertanggungjawaban kepatuhan kepada OJK | Paparan risiko sanksi tetap tinggi |
| Kepala SKAI | Audit Internal | Efektivitas & efisiensi penugasan audit | Kapasitas audit habis untuk administrasi |
| Komite Audit | Dewan Komisaris | Keyakinan atas pengendalian internal | Pengawasan tetap berbasis laporan manual |
| Kepala Divisi TI | TI | Kelayakan teknis, beban operasional | Beban permintaan data ad-hoc tetap |
| IT Security Officer | TI | Kontrol akses & keamanan siber | Risiko akses tidak sah tetap |
| Application Owner | Berbagai unit | Beban kerja siklus review | Tetap mengerjakan spreadsheet tiap semester |
| Manajer Lini | Berbagai unit | Kejelasan tugas review | Review tetap terasa formalitas |
| Divisi HRD | HRD | Akurasi data karyawan sebagai rujukan | Ketidakcocokan data akses vs kepegawaian |
| Manajemen Risiko | Risk | Visibilitas risiko operasional & TI | Pemantauan tetap periodik dan lambat |
| Seluruh karyawan | Semua | Kemudahan menemukan aturan kerja | Ketidakpatuhan karena ketidaktahuan |
| Auditor eksternal / regulator | Eksternal | Akses bukti yang tertib & terverifikasi | Proses pemeriksaan berlarut |

### 5.2 Matriks RACI implementasi

| Aktivitas | Dir. Kepatuhan | SKAI | Divisi TI | IT Security | Pemilik Aplikasi | HRD |
|---|---|---|---|---|---|---|
| Persetujuan ruang lingkup & anggaran | **A** | C | C | C | I | I |
| Penyusunan kebutuhan detail | C | **R** | C | R | C | C |
| Pembangunan & integrasi sistem | I | I | **R/A** | C | C | I |
| Penyediaan data akses aplikasi | I | I | C | **R** | **R** | I |
| Penyediaan data induk karyawan | I | I | C | C | I | **R** |
| Migrasi kebijakan & SOP | **A** | C | C | I | R | C |
| Penyusunan control library | C | **R** | C | R | I | I |
| UAT & serah terima | C | **R** | R | R | C | C |
| Operasional harian pasca go-live | **A** | R | R | **R** | R | C |

R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 6. Ruang Lingkup

### 6.1 Termasuk dalam ruang lingkup

**Modul A — Evidence Vault**

- Pengelolaan penugasan audit, assessment, dan pemeriksaan regulator.
- *Control library* dengan pemetaan silang ke banyak framework (POJK, ISO 27001, COBIT, kebijakan internal).
- Daftar permintaan bukti (PBC) dengan penanggung jawab, tenggat, pengingat, dan eskalasi.
- Penyimpanan bukti dengan versi, hash integritas, dan jejak rantai kepemilikan.
- Penggunaan ulang satu bukti untuk banyak kontrol dan banyak penugasan.
- Pencatatan temuan dan pemantauan tindak lanjut perbaikan.
- Portal auditor eksternal dengan akses baca terbatas waktu dan terbatas cakupan.
- Kebijakan retensi dan *legal hold*.

**Modul B — Access Review**

- Registri aplikasi beserta pemilik aplikasi dan tingkat kekritisan.
- Pengambilan data identitas & hak akses melalui konektor otomatis dan unggahan CSV bertemplat.
- Rekonsiliasi terhadap data kepegawaian dan Active Directory.
- Kampanye review dengan cakupan, penugasan reviewer, jadwal, dan pengingat.
- Antarmuka keputusan reviewer dengan alasan wajib dan penyorotan akses berisiko.
- Sign-off berjenjang dengan identitas terverifikasi.
- Tiket pencabutan akses dan verifikasi penutupannya pada snapshot berikutnya.
- Matriks konflik pemisahan tugas berbasis aturan.
- Pembentukan paket bukti kampanye secara otomatis ke Modul A.

**Modul C — Policy Hub**

- Taksonomi dokumen, unit pemilik, dan klasifikasi kerahasiaan.
- Siklus hidup dokumen dari penyusunan sampai penarikan, dengan persetujuan berjenjang.
- Versi, tanggal berlaku, tanggal kedaluwarsa, dan pengingat tinjauan berkala.
- Pencarian hibrida (kata kunci dan makna) yang menghormati hak akses pembaca.
- Jawaban ringkas berbasis dokumen dengan rujukan ke nomor pasal/bab.
- Kampanye pernyataan telah membaca (*acknowledgement*).
- Keterkaitan SOP dengan kontrol dan bukti di Modul A.

**Lintas modul**

- Autentikasi tunggal melalui Active Directory.
- Model peran dan hak akses granular.
- Jejak audit yang tidak dapat diubah untuk seluruh aksi.
- Dasbor dan pelaporan standar, termasuk laporan siap serah kepada auditor.
- Notifikasi surel dan dalam aplikasi.

### 6.2 Di luar ruang lingkup

| Hal | Alasan |
|---|---|
| Penyediaan/pencabutan akses otomatis (*provisioning*) ke aplikasi target | Membutuhkan hak tulis ke sistem produksi; risiko dan kompleksitas jauh lebih tinggi. SIGAP menghasilkan permintaan pencabutan, eksekusinya tetap melalui proses TI yang ada. Dipertimbangkan pada fase berikutnya. |
| Single Sign-On untuk seluruh aplikasi perusahaan | Ini program identitas tersendiri, bukan bagian dari SIGAP. |
| Sistem manajemen dokumen umum (DMS) untuk seluruh jenis dokumen | Modul C khusus untuk kebijakan, SOP, dan instruksi kerja. Bukan pengganti berbagi berkas umum. |
| Manajemen risiko perusahaan (ERM) dan risk register penuh | Dipertimbangkan sebagai modul terpisah setelah SIGAP stabil. |
| Pemantauan keamanan real-time (SIEM) | Sudah/akan ditangani perangkat keamanan tersendiri. |
| Sistem tiket layanan TI (ITSM) | SIGAP terintegrasi dengan sistem tiket yang ada, tidak menggantikannya. |
| Manajemen pelatihan & LMS | Attestation di Modul C bukan pengganti pelatihan formal. |
| Penilaian risiko pihak ketiga (vendor risk) | Fase berikutnya. |

### 6.3 Ketergantungan eksternal

| Kode | Ketergantungan | Pemilik | Risiko bila tidak terpenuhi |
|---|---|---|---|
| DEP-01 | Akses baca ke Active Directory (LDAP bind account) | Divisi TI | Modul B dan autentikasi tidak dapat berjalan |
| DEP-02 | Data induk karyawan yang mutakhir dari HRD | HRD | Rekonsiliasi akun tidak akurat |
| DEP-03 | Kesediaan application owner menyediakan data hak akses | Unit terkait | Cakupan kampanye UAR menyempit |
| DEP-04 | Kapasitas server on-premise & penyimpanan objek | Divisi TI | Implementasi tertunda |
| DEP-05 | Persetujuan Kepatuhan atas penggunaan layanan LLM eksternal | Dir. Kepatuhan | Fitur jawaban otomatis Modul C harus diturunkan lingkupnya |
| DEP-06 | Kumpulan kebijakan & SOP yang sudah disahkan untuk dimigrasikan | Unit pemilik | Modul C diluncurkan dengan konten minim |
| DEP-07 | Penyusunan control library awal | SKAI | Modul A tidak dapat memetakan bukti ke kontrol |

---

## 7. Asumsi

| Kode | Asumsi | Dampak bila keliru |
|---|---|---|
| ASM-01 | Jumlah karyawan 300–1.000 orang, **satu badan hukum: PT Trimegah Sekuritas Indonesia Tbk saja** | **Perlu konfirmasi.** Trimegah memiliki anak usaha, di antaranya PT Trimegah Asset Management. Bila anak usaha ikut memakai SIGAP, dibutuhkan pemisahan data antar-entitas dan konsolidasi laporan di tingkat grup — perubahan arsitektur yang tidak tercakup rancangan ini. Lihat pertanyaan terbuka Q-08 pada [02-PRD §8](02-PRD.md) |
| ASM-02 | Jumlah aplikasi dalam ruang lingkup 20–50 | Bila jauh lebih banyak, upaya integrasi meningkat proporsional |
| ASM-03 | Active Directory adalah sumber identitas utama dan dapat diandalkan | Bila data AD kotor, rekonsiliasi menghasilkan banyak positif palsu |
| ASM-04 | Perusahaan memiliki DC dan DRC sendiri dengan kapasitas memadai | Perlu pengadaan infrastruktur tambahan |
| ASM-05 | Volume bukti < 500 GB dalam 5 tahun | Perlu penyesuaian kapasitas penyimpanan |
| ASM-06 | Jumlah dokumen kebijakan & SOP 500–2.000 dokumen | Memengaruhi biaya pengindeksan awal |
| ASM-07 | Kebijakan perusahaan mengizinkan pengiriman dokumen berklasifikasi Internal ke penyedia LLM eksternal dengan kontrak yang sesuai | Bila tidak diizinkan, fitur jawaban otomatis harus memakai model lokal atau ditiadakan |
| ASM-08 | Tersedia tim pengembang internal atau vendor dengan kompetensi Node.js/TypeScript | Perlu pelatihan atau penyesuaian teknologi |
| ASM-09 | Proses bisnis audit dan UAR yang ada dapat disesuaikan mengikuti sistem | Bila proses harus dipertahankan apa adanya, kustomisasi meningkat |

---

## 8. Kebutuhan Bisnis Tingkat Tinggi

Kebutuhan berikut adalah pernyataan *apa* yang harus dicapai, bukan *bagaimana*. Penjabaran teknisnya ada di PRD dan FRD.

### 8.1 Modul A — Evidence Vault

| Kode | Kebutuhan bisnis | Prioritas | Sasaran terkait |
|---|---|---|---|
| BR-A-01 | Perusahaan harus dapat mengelola seluruh permintaan bukti dari semua sumber audit dalam satu tempat | Must | OBJ-01, OBJ-03 |
| BR-A-02 | Setiap bukti harus dapat dibuktikan keasliannya: siapa mengunggah, kapan, versi ke berapa, dan apakah pernah diubah | Must | OBJ-03 |
| BR-A-03 | Satu bukti harus dapat digunakan untuk memenuhi banyak kontrol dan banyak framework tanpa diunggah ulang | Must | OBJ-02 |
| BR-A-04 | Sistem harus menagih dan mengeskalasi permintaan bukti yang mendekati atau melewati tenggat secara otomatis | Must | OBJ-01, OBJ-03 |
| BR-A-05 | Auditor eksternal harus dapat mengakses bukti yang relevan tanpa diberi akses ke seluruh sistem | Must | OBJ-01 |
| BR-A-06 | Temuan audit dan tindak lanjutnya harus terpantau sampai tuntas | Should | OBJ-12 |
| BR-A-07 | Bukti harus tunduk pada kebijakan retensi dan dapat ditahan penghapusannya bila ada kebutuhan hukum | Must | REG-11 |
| BR-A-08 | Manajemen harus dapat melihat status kesiapan bukti per penugasan secara real-time | Should | OBJ-12 |

### 8.2 Modul B — Access Review

| Kode | Kebutuhan bisnis | Prioritas | Sasaran terkait |
|---|---|---|---|
| BR-B-01 | Perusahaan harus memiliki daftar lengkap aplikasi beserta pemilik dan tingkat kekritisannya | Must | REG-03 |
| BR-B-02 | Data pengguna dan hak akses dari aplikasi berbeda harus dapat dikumpulkan secara terjadwal, baik otomatis maupun melalui unggahan | Must | OBJ-04 |
| BR-B-03 | Sistem harus menyandingkan data akses dengan data kepegawaian untuk menemukan akun yang seharusnya tidak ada lagi | Must | OBJ-06 |
| BR-B-04 | Kampanye review harus dapat dijalankan terjadwal dengan reviewer yang ditentukan berdasarkan aturan | Must | OBJ-04 |
| BR-B-05 | Setiap keputusan reviewer harus terekam dengan identitas terverifikasi dan alasan untuk keputusan selain "pertahankan" | Must | OBJ-07 |
| BR-B-06 | Antarmuka review harus dirancang agar reviewer tidak dapat menyetujui seluruh akses secara asal | Must | OBJ-07 |
| BR-B-07 | Setiap keputusan "cabut" harus melahirkan tiket dan diverifikasi penutupannya pada pengambilan data berikutnya | Must | OBJ-05 |
| BR-B-08 | Sistem harus menandai kombinasi akses yang melanggar prinsip pemisahan tugas | Should | REG-04 |
| BR-B-09 | Seluruh hasil kampanye harus dapat diserahkan sebagai paket bukti tunggal kepada auditor | Must | OBJ-02, OBJ-07 |
| BR-B-10 | Akses istimewa harus ditinjau dengan frekuensi lebih tinggi dan penelaahan lebih ketat | Should | REG-09 |

### 8.3 Modul C — Policy Hub

| Kode | Kebutuhan bisnis | Prioritas | Sasaran terkait |
|---|---|---|---|
| BR-C-01 | Karyawan harus dapat menemukan kebijakan dan SOP yang berlaku dengan bahasa sehari-hari, bukan dengan menebak nama berkas | Must | OBJ-08 |
| BR-C-02 | Hasil pencarian hanya boleh menampilkan dokumen yang boleh diakses oleh pencari | Must | OBJ-11, REG-11 |
| BR-C-03 | Hanya versi yang sedang berlaku yang boleh muncul sebagai acuan; versi lama tetap tersimpan untuk keperluan audit | Must | OBJ-09 |
| BR-C-04 | Sistem dapat memberikan jawaban ringkas atas pertanyaan karyawan, selalu disertai rujukan ke bagian dokumen sumber | Should | OBJ-08 |
| BR-C-05 | Penyusunan dan pengesahan dokumen harus melalui alur persetujuan yang tercatat | Must | REG-08 |
| BR-C-06 | Dokumen harus memiliki jadwal tinjauan berkala dengan pengingat otomatis kepada pemiliknya | Must | REG-02 |
| BR-C-07 | Perusahaan harus dapat membuktikan bahwa karyawan tertentu telah membaca kebijakan tertentu | Must | OBJ-10, REG-07 |
| BR-C-08 | Dokumen berklasifikasi tinggi tidak boleh diproses oleh layanan pihak ketiga mana pun | Must | OBJ-11, REG-11 |
| BR-C-09 | SOP harus dapat ditautkan ke kontrol audit sehingga auditor melihat prosedur dan buktinya berdampingan | Should | OBJ-02 |

### 8.4 Lintas modul

| Kode | Kebutuhan bisnis | Prioritas | Sasaran terkait |
|---|---|---|---|
| BR-X-01 | Pengguna masuk dengan akun perusahaan yang sudah ada, tanpa kata sandi baru | Must | — |
| BR-X-02 | Hak akses dalam SIGAP sendiri harus granular dan tunduk pada pemisahan tugas | Must | REG-04 |
| BR-X-03 | Seluruh aksi pengguna harus terekam dalam jejak audit yang tidak dapat diubah atau dihapus | Must | REG-01 |
| BR-X-04 | Manajemen harus memiliki dasbor konsolidasi lintas ketiga modul | Should | OBJ-12 |
| BR-X-05 | Data perusahaan tidak boleh keluar dari kendali perusahaan kecuali melalui jalur yang disetujui dan tercatat | Must | OBJ-11, REG-11 |
| BR-X-06 | Sistem harus tetap dapat diaudit ketika terjadi perpindahan personel, termasuk delegasi tugas persetujuan | Should | — |

---

## 9. Manfaat & Justifikasi Investasi

### 9.1 Manfaat terukur

| Manfaat | Perhitungan | Nilai tahunan |
|---|---|---|
| Efisiensi pemenuhan bukti audit | 58% dari 1.277 jam × Rp 150.000 | Rp 111 juta |
| Efisiensi siklus UAR | 60% dari 590 jam × Rp 150.000 | Rp 53 juta |
| Efisiensi pencarian dokumen | 70% dari 2.730 jam × Rp 150.000 | Rp 287 juta |
| **Subtotal manfaat terukur** | | **Rp 451 juta/tahun** |

### 9.2 Manfaat tidak terukur

- **Penurunan risiko sanksi regulator.** Kesiapan bukti dan kemampuan menunjukkan pengendalian akses yang berjalan mengurangi kemungkinan temuan material pada pemeriksaan OJK.
- **Penurunan risiko akses tidak sah.** Deteksi akun karyawan yang sudah berhenti dan konflik pemisahan tugas menutup jalur penyalahgunaan yang selama ini tidak terlihat.
- **Kesiapan sertifikasi.** Bukti yang terorganisasi memperpendek persiapan sertifikasi ISO 27001 atau audit induk secara signifikan.
- **Kualitas keputusan manajemen.** Dasbor kepatuhan memberi Direksi dan Komite Audit gambaran kondisi terkini, bukan potret bulan lalu.
- **Ketahanan pengetahuan organisasi.** Prosedur yang mudah ditemukan mengurangi ketergantungan pada pengetahuan personal.

### 9.3 Indikasi biaya

Biaya bersifat indikatif untuk keperluan perencanaan anggaran. Angka final ditetapkan setelah TRD disepakati dan, bila menggunakan vendor, setelah proses pengadaan.

| Komponen | Sifat | Indikasi |
|---|---|---|
| Pengembangan aplikasi (3 fase, ± 9 bulan) | Sekali | Beban terbesar; dirinci pada dokumen anggaran terpisah |
| Perangkat keras server on-premise (aplikasi, basis data, penyimpanan objek) di DC dan DRC | Sekali | Menengah |
| Lisensi perangkat lunak pendukung | Berulang | Rendah — komponen utama berlisensi terbuka |
| Layanan LLM eksternal untuk fitur jawaban otomatis | Berulang | Rendah–menengah, bergantung volume pemakaian |
| Migrasi konten kebijakan & penyusunan control library | Sekali | Menengah, sebagian besar berupa waktu tim internal |
| Pemeliharaan & dukungan tahunan | Berulang | 15–20% dari biaya pengembangan |

**Titik impas (*payback*) diperkirakan tercapai pada tahun kedua** berdasarkan manfaat terukur saja, tanpa memperhitungkan manfaat penurunan risiko.

---

## 10. Risiko Bisnis & Mitigasi

| Kode | Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|---|
| RSK-01 | Application owner tidak menyediakan data hak akses tepat waktu, kampanye UAR mandek | Tinggi | Tinggi | Sediakan jalur unggah CSV yang sangat sederhana; jadikan penyediaan data sebagai kewajiban dalam kebijakan; tampilkan papan kepatuhan penyediaan data kepada manajemen |
| RSK-02 | Reviewer tetap melakukan persetujuan asal meski antarmuka baru | Tinggi | Tinggi | Alasan wajib untuk keputusan non-*certify*; penyorotan akses berisiko; laporan pola keputusan reviewer kepada atasan; uji petik oleh SKAI |
| RSK-03 | Data Active Directory dan data HR tidak sinkron, menghasilkan banyak temuan palsu | Sedang | Sedang | Lakukan pembersihan data sebagai prasyarat fase; sediakan mekanisme pengecualian yang tercatat |
| RSK-04 | Isi kebijakan internal terekspos ke penyedia LLM eksternal | Sedang | **Sangat tinggi** | Gerbang klasifikasi dokumen; hanya klasifikasi Publik dan Internal yang boleh keluar; redaksi data pribadi; perjanjian tanpa retensi dan tanpa pelatihan; pencatatan penuh; tombol pemutus; opsi berpindah ke model lokal |
| RSK-05 | Jawaban otomatis keliru dan dijadikan dasar tindakan | Sedang | Tinggi | Setiap jawaban wajib menyertakan rujukan pasal; peringatan bahwa dokumen sumber adalah acuan yang mengikat; tidak menampilkan jawaban bila keyakinan rendah |
| RSK-06 | Adopsi rendah, karyawan kembali ke cara lama | Sedang | Tinggi | Pencarian dibuat sebagai pintu masuk tunggal; hentikan distribusi kebijakan lewat email; sosialisasi bertahap; ukur adopsi mingguan |
| RSK-07 | Migrasi kebijakan tertunda sehingga modul diluncurkan kosong | Sedang | Sedang | Tetapkan target 200 dokumen prioritas untuk go-live; libatkan unit pemilik sejak awal |
| RSK-08 | Ruang lingkup melebar (*scope creep*) menjadi ERM atau DMS umum | Tinggi | Sedang | Daftar di luar lingkup pada §6.2 mengikat; perubahan lingkup melalui persetujuan Steering Committee |
| RSK-09 | Ketergantungan pada satu vendor atau satu pengembang kunci | Sedang | Sedang | Dokumentasi teknis lengkap; penggunaan teknologi umum; transfer pengetahuan sebagai syarat serah terima |
| RSK-10 | Sistem berisi konsentrasi data sensitif sehingga menjadi sasaran menarik | Sedang | Tinggi | Kontrol keamanan berlapis, uji penetrasi sebelum go-live, pemisahan tugas administrator, jejak audit tak terubah |
| RSK-11 | Beban kerja tambahan bagi unit pada masa transisi menimbulkan penolakan | Tinggi | Sedang | Peluncuran bertahap per modul; dukungan pendampingan pada siklus pertama; tunjukkan penghematan pada siklus kedua |

---

## 11. Roadmap Implementasi

Urutan fase ditentukan oleh dua pertimbangan: **memberi kemenangan cepat yang terasa oleh banyak orang** dan **membangun fondasi sebelum modul yang bergantung padanya**.

### Fase 1 — Fondasi & Policy Hub (Bulan 1–3)

Fokus pada modul yang paling luas manfaatnya dan paling ringan ketergantungannya. Modul C menyentuh seluruh karyawan, sehingga menjadi pembentuk kebiasaan menggunakan SIGAP.

- Fondasi platform: autentikasi AD, model peran, jejak audit, penyimpanan objek, notifikasi.
- Modul C penuh: siklus hidup dokumen, pencarian hibrida, attestation.
- Fitur jawaban otomatis dengan gerbang klasifikasi.
- Migrasi 200 dokumen kebijakan prioritas.

*Kriteria keberhasilan fase:* 70% karyawan aktif menggunakan pencarian dalam 4 minggu pasca-peluncuran; seluruh kebijakan wajib memiliki versi berlaku yang jelas.

### Fase 2 — Evidence Vault (Bulan 4–6)

- Control library dan pemetaan framework.
- Penugasan audit, PBC, unggah dan penggunaan ulang bukti.
- Temuan dan tindak lanjut.
- Portal auditor eksternal.
- Uji coba pada satu penugasan audit internal nyata.

*Kriteria keberhasilan fase:* satu penugasan audit penuh dijalankan tanpa email untuk pertukaran bukti.

### Fase 3 — Access Review (Bulan 7–9)

- Registri aplikasi, kerangka konektor, unggah CSV.
- Rekonsiliasi terhadap AD dan data HR.
- Kampanye, antarmuka reviewer, sign-off, tiket pencabutan dan verifikasinya.
- Aturan pemisahan tugas.
- Pembentukan paket bukti otomatis ke Modul A.
- Kampanye percontohan pada 5 aplikasi paling kritis, dilanjutkan perluasan bertahap.

*Kriteria keberhasilan fase:* satu siklus UAR penuh selesai dalam 10 hari kerja dengan bukti sign-off yang dapat diserahkan langsung kepada auditor.

### Pasca-implementasi (Bulan 10–12)

- Perluasan cakupan aplikasi UAR sampai seluruh aplikasi kritis.
- Penyempurnaan dasbor manajemen.
- Evaluasi pencapaian KPI dan penetapan kandidat fase berikutnya (provisioning otomatis, vendor risk, ERM).

---

## 12. Kriteria Penerimaan Tingkat Bisnis

Proyek dinyatakan berhasil apabila seluruh kondisi berikut terpenuhi dalam 12 bulan setelah peluncuran fase terakhir:

1. Satu siklus audit internal penuh dijalankan sepenuhnya di dalam SIGAP tanpa pertukaran bukti melalui email.
2. Satu siklus UAR penuh selesai dalam 10 hari kerja dengan seluruh keputusan memiliki identitas dan alasan tercatat.
3. Seluruh item keputusan "cabut" pada siklus tersebut terverifikasi tertutup pada snapshot berikutnya, atau memiliki pengecualian yang disetujui dan tercatat.
4. Auditor eksternal atau pemeriksa dapat menerima paket bukti langsung dari sistem dan menyatakan memadai.
5. Tidak ada dokumen berklasifikasi Terbatas atau Rahasia yang terkirim ke layanan pihak ketiga, dibuktikan melalui pencatatan gerbang LLM.
6. Pencapaian minimal 8 dari 12 KPI pada §4 memenuhi target.
7. Tidak terdapat temuan audit berkategori tinggi atas SIGAP itu sendiri pada tinjauan keamanan pasca-implementasi.

---

## 13. Persetujuan

| Peran | Nama | Tanda tangan | Tanggal |
|---|---|---|---|
| Direktur Kepatuhan | | | |
| Direktur Operasional / TI | | | |
| Kepala SKAI | | | |
| Kepala Divisi TI | | | |
| Ketua Komite Audit (mengetahui) | | | |

---

## Lampiran A — Referensi Produk Sejenis

Ditelaah sebagai pembanding kapabilitas dan sumber pola rancangan.

**Manajemen bukti audit & GRC**
- AuditBoard — https://www.auditboard.com/
- Hyperproof — https://hyperproof.io/ (pola *collect once, map to many* diadopsi)
- Workiva — https://www.workiva.com/
- Gartner Peer Insights, Audit Management Solutions — https://www.gartner.com/reviews/market/audit-management-solutions
- Daftar fitur wajib alat manajemen bukti audit — https://www.floqast.com/blog/10-must-have-features-in-audit-evidence-management-tools

**Sumber terbuka untuk studi model data**
- Probo — https://github.com/getprobo/probo
- CISO Assistant — https://github.com/intuitem/ciso-assistant-community
- Eramba — https://www.eramba.org/
- SimpleRisk — https://www.simplerisk.com/

**Review hak akses & tata kelola identitas**
- SailPoint — https://www.sailpoint.com/compare
- Saviynt — https://saviynt.com/
- Veza — https://veza.com/blog/user-access-review-software/
- ConductorOne — https://www.conductorone.com/
- Zluri, perbandingan alat IGA — https://www.zluri.com/eye-on-identity/iga-tools-comparison-compliance-access-reviews-veza-lumos-zluri
- Microsoft Entra ID Governance, Access Reviews — https://learn.microsoft.com/en-us/entra/id-governance/access-reviews-overview
- Panduan pembeli UAR — https://www.balkan.id/buyers-guide/user-access-review-software

**Manajemen kebijakan & pencarian dokumen**
- NAVEX PolicyTech — https://www.navex.com/en-us/platform/policy-procedure-management/
- PowerDMS — https://www.powerdms.com/policy-learning-center/buyers-guide-policy-management-tools
- ComplianceBridge — https://compliancebridge.com/
- Glean — https://www.glean.com/
- Guru — https://www.getguru.com/

**Rujukan regulasi**
- POJK Manajemen Risiko TI — https://ojk.go.id/id/regulasi/Pages/POJK-tentang-Penerapan-Manajemen-Risiko-dalam-Penggunaan-Teknologi-Informasi-Oleh-Bank-Umum.aspx
- SEOJK 29/SEOJK.03/2022, Ketahanan & Keamanan Siber — https://www.ojk.go.id/id/regulasi/Documents/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum/SEOJK%2029%20SEOJK.03%202022.pdf
- Ringkasan ketentuan Perusahaan Efek — https://prolegal.id/update-peraturan-ojk-tentang-perusahaan-efek-apa-saja-poin-pentingnya/

---

*Dokumen terkait: [02-PRD.md](02-PRD.md) · [03-FRD.md](03-FRD.md) · [04-TRD.md](04-TRD.md)*
