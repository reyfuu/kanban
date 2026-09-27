# PRD — Product Requirements Document
## SIGAP: Sistem Integrasi Governance, Akses, dan Prosedur

| | |
|---|---|
| **Dokumen** | Product Requirements Document (PRD) |
| **Produk** | SIGAP v1.0 |
| **Versi dokumen** | 1.0 |
| **Tanggal** | 27 Agustus 2026 |
| **Audiens** | Product Owner, Tim Pengembang, QA, UI/UX Designer, SKAI, IT Security |
| **Dokumen induk** | [01-BRD.md](01-BRD.md) |
| **Status** | Draft |
| **Klasifikasi** | Internal |

---

## 1. Visi Produk

> **Satu tempat untuk membuktikan bahwa perusahaan menjalankan apa yang tertulis dalam prosedurnya.**

SIGAP menyatukan tiga pertanyaan yang selalu diajukan auditor dan regulator:

1. *"Tunjukkan buktinya."* → Modul A, Evidence Vault
2. *"Siapa saja yang punya akses, dan siapa yang menyetujuinya?"* → Modul B, Access Review
3. *"Mana aturannya, dan apakah orang Anda tahu?"* → Modul C, Policy Hub

Ketiganya dibangun di atas satu fondasi data bersama, sehingga jawaban atas pertanyaan kedua otomatis menjadi bahan jawaban pertanyaan pertama, dan jawaban pertanyaan ketiga menjadi konteksnya.

### 1.1 Pernyataan posisi produk

> **Untuk** fungsi kepatuhan, audit internal, dan keamanan TI di perusahaan sekuritas
> **yang** menghabiskan sebagian besar waktunya pada administrasi bukti alih-alih analisis risiko,
> **SIGAP adalah** platform tata kelola internal
> **yang** menghubungkan prosedur, hak akses, dan bukti kepatuhan dalam satu rantai yang dapat ditelusuri,
> **berbeda dengan** membeli tiga produk terpisah untuk manajemen kebijakan, sertifikasi akses, dan manajemen audit,
> **produk kami** menjadikan hasil satu proses sebagai masukan proses lainnya secara otomatis, dan berjalan sepenuhnya di dalam pusat data perusahaan.

### 1.2 Prinsip produk

| # | Prinsip | Konsekuensi rancangan |
|---|---|---|
| P1 | **Bukti dikumpulkan sekali, dipakai berkali-kali** | Bukti adalah entitas kelas satu yang berdiri sendiri, bukan lampiran dari satu penugasan |
| P2 | **Setiap aksi meninggalkan jejak yang tak terhapus** | Jejak audit bukan fitur tambahan, melainkan lapisan wajib pada seluruh operasi tulis |
| P3 | **Antarmuka menolak persetujuan asal-asalan** | Tidak ada pilihan default pada keputusan review; alasan wajib untuk keputusan berdampak |
| P4 | **Jawaban tanpa rujukan tidak boleh ditampilkan** | Setiap jawaban otomatis wajib menyertakan kutipan dan tautan ke pasal sumber |
| P5 | **Klasifikasi data menentukan ke mana data boleh pergi** | Gerbang keluar berbasis klasifikasi, ditegakkan di lapisan sistem, bukan diserahkan ke kebijaksanaan pengguna |
| P6 | **Kecepatan menemukan lebih penting daripada kelengkapan fitur** | Pencarian global tersedia dari mana saja; jalur menuju informasi diprioritaskan di atas kekayaan menu |
| P7 | **Sistem menagih, manusia memutuskan** | Otomasi menangani pengingat, eskalasi, rekonsiliasi, dan penyusunan berkas; keputusan tetap pada manusia yang bertanggung jawab |

---

## 2. Analisis Pembanding & Diferensiasi

| Produk | Kekuatan yang diadopsi | Batasan yang dihindari |
|---|---|---|
| **Hyperproof** | Model *evidence once, mapped to many controls*; koleksi bukti terotomasi via konektor | Berbasis SaaS, data keluar dari kendali perusahaan |
| **AuditBoard** | Alur kerja audit internal dan pemantauan temuan yang matang | Berat, mahal, dan terlalu berorientasi SOX untuk kebutuhan lokal |
| **Workiva** | Keterhubungan data dan narasi antar-dokumen | Fokus pada pelaporan keuangan, bukan operasional kepatuhan harian |
| **SailPoint / Saviynt** | Mesin kampanye sertifikasi dan pemisahan tugas yang lengkap | Biaya dan kompleksitas implementasi tidak proporsional untuk 30 aplikasi |
| **Veza** | Visualisasi keterhubungan identitas–hak akses–data | Berfokus pada infrastruktur cloud, sedangkan aplikasi kami sebagian besar legacy on-premise |
| **Microsoft Entra Access Reviews** | Alur keputusan reviewer yang ringkas dan mudah dipahami | Hanya mencakup aplikasi yang terintegrasi Entra |
| **NAVEX PolicyTech** | Siklus hidup kebijakan, attestation, dan asisten tanya-jawab kebijakan | SaaS; penyesuaian taksonomi lokal terbatas |
| **Glean / Guru** | Pencarian perusahaan yang menghormati hak akses, dengan jawaban ber-sitasi | Umum, tidak memahami konsep versi berlaku dan pengesahan dokumen |

### Diferensiasi SIGAP

1. **Rantai bukti lintas modul.** Sertifikasi akses menghasilkan paket bukti yang langsung menempel pada kontrol audit. Tidak ada produk pembanding yang menyatukan ketiganya untuk skala organisasi menengah.
2. **Berjalan di dalam pusat data sendiri.** Memenuhi ekspektasi kedaulatan data untuk industri keuangan Indonesia.
3. **Dirancang untuk lanskap aplikasi campuran.** Konektor otomatis untuk yang modern, unggahan bertemplat untuk yang legacy — tanpa memaksa semua aplikasi memiliki API.
4. **Kosakata dan kerangka kepatuhan lokal.** Control library berbasis ketentuan OJK, bukan hanya SOC 2 dan SOX.
5. **Bertumpu pada bahasa Indonesia.** Pencarian, pengindeksan, dan antarmuka dirancang untuk konten berbahasa Indonesia.

---

## 3. Persona Pengguna

### PER-01 — Ratna, Compliance Officer

| | |
|---|---|
| **Peran** | Officer Divisi Kepatuhan, 6 tahun di industri |
| **Tugas yang ingin diselesaikan** | Memastikan perusahaan siap kapan pun diperiksa, dan menjawab pertanyaan regulator tanpa panik |
| **Frustrasi** | Setiap pemeriksaan berarti berburu bukti dari nol; sering menemukan unit memakai SOP versi lama |
| **Definisi sukses** | Bisa menunjukkan bukti apa pun dalam hitungan menit, lengkap dengan riwayatnya |
| **Frekuensi pemakaian** | Harian |
| **Kemampuan teknis** | Menengah |

### PER-02 — Bayu, Auditor Internal (SKAI)

| | |
|---|---|
| **Peran** | Senior Auditor, memimpin 4–5 penugasan per tahun |
| **Tugas yang ingin diselesaikan** | Menjalankan penugasan audit dari perencanaan sampai laporan tanpa kehilangan waktu untuk menagih bukti |
| **Frustrasi** | 60% waktunya habis menagih lampiran lewat email dan merapikan berkas |
| **Definisi sukses** | Status kesiapan bukti terlihat sekilas; kertas kerja tersusun sendiri dari bukti yang masuk |
| **Frekuensi pemakaian** | Harian saat penugasan berjalan |
| **Kemampuan teknis** | Menengah |

### PER-03 — Dimas, IT Security Officer

| | |
|---|---|
| **Peran** | Penanggung jawab kontrol akses dan keamanan siber |
| **Tugas yang ingin diselesaikan** | Menjalankan siklus UAR yang benar-benar bermakna, bukan sekadar formalitas |
| **Frustrasi** | Mengejar 30 application owner tiap semester; tidak yakin pencabutan benar dieksekusi |
| **Definisi sukses** | Kampanye berjalan otomatis; ia hanya menangani pengecualian dan eskalasi |
| **Frekuensi pemakaian** | Harian |
| **Kemampuan teknis** | Tinggi |

### PER-04 — Sari, Application Owner

| | |
|---|---|
| **Peran** | Kepala Bagian Operasional, pemilik aplikasi back office |
| **Tugas yang ingin diselesaikan** | Menyelesaikan kewajiban review tanpa mengganggu pekerjaan utamanya |
| **Frustrasi** | Diminta mengekspor data dalam format yang berbeda-beda setiap siklus |
| **Definisi sukses** | Unggah satu berkas, atau tidak perlu unggah sama sekali; review selesai dalam satu jam |
| **Frekuensi pemakaian** | Beberapa kali per semester, memuncak saat kampanye |
| **Kemampuan teknis** | Rendah–menengah |

### PER-05 — Andi, Manajer Lini

| | |
|---|---|
| **Peran** | Kepala Bagian Dealing, membawahi 12 orang |
| **Tugas yang ingin diselesaikan** | Menyetujui akses anak buahnya dengan benar tanpa harus memahami istilah teknis TI |
| **Frustrasi** | Daftar hak akses berisi nama peran teknis yang tidak ia mengerti |
| **Definisi sukses** | Melihat penjelasan apa arti setiap akses dalam bahasa manusia, lalu memutuskan dengan yakin |
| **Frekuensi pemakaian** | Dua kali setahun, plus saat ada anggota tim baru |
| **Kemampuan teknis** | Rendah |

### PER-06 — Nadia, Karyawan Operasional

| | |
|---|---|
| **Peran** | Staf Settlement |
| **Tugas yang ingin diselesaikan** | Menemukan aturan yang berlaku ketika menghadapi kasus tidak biasa, saat itu juga |
| **Frustrasi** | Tidak tahu dokumen mana yang berlaku; akhirnya bertanya ke rekan |
| **Definisi sukses** | Mengetik pertanyaan dengan bahasa sendiri dan mendapat jawaban beserta rujukan pasalnya |
| **Frekuensi pemakaian** | Mingguan |
| **Kemampuan teknis** | Rendah |

### PER-07 — Pak Hendra, Direktur Kepatuhan

| | |
|---|---|
| **Peran** | Anggota Direksi, penanggung jawab kepatuhan |
| **Tugas yang ingin diselesaikan** | Mengetahui posisi kepatuhan perusahaan sebelum ditanya Komite Audit atau regulator |
| **Frustrasi** | Informasi datang dalam bentuk laporan bulanan yang sudah basi |
| **Definisi sukses** | Membuka satu halaman dan melihat kondisi terkini beserta hal yang perlu perhatiannya |
| **Frekuensi pemakaian** | Mingguan |
| **Kemampuan teknis** | Rendah |

### PER-08 — Auditor Eksternal (pengguna tamu)

| | |
|---|---|
| **Peran** | Auditor KAP atau pemeriksa regulator |
| **Tugas yang ingin diselesaikan** | Memperoleh bukti yang diminta dengan cepat dan meyakini keasliannya |
| **Frustrasi** | Menunggu lampiran email dan tidak yakin berkas yang diterima adalah versi final |
| **Definisi sukses** | Mengakses portal terbatas, mengunduh bukti beserta metadata keasliannya |
| **Frekuensi pemakaian** | Intensif selama periode pemeriksaan |
| **Kemampuan teknis** | Menengah |

---

## 4. Epic & User Story

Setiap user story memiliki ID stabil yang dirujuk oleh FRD dan matriks keterlacakan. Format kriteria penerimaan: **Diberikan / Ketika / Maka**.

### Ringkasan epic

| Epic | Nama | Modul | Prioritas | Fase |
|---|---|---|---|---|
| EP-01 | Fondasi identitas, peran & jejak audit | Lintas | Must | 1 |
| EP-02 | Siklus hidup dokumen kebijakan | C | Must | 1 |
| EP-03 | Pencarian & jawaban berbasis kebijakan | C | Must | 1 |
| EP-04 | Attestation kebijakan | C | Must | 1 |
| EP-05 | Control library & pemetaan framework | A | Must | 2 |
| EP-06 | Penugasan audit & permintaan bukti | A | Must | 2 |
| EP-07 | Pengelolaan bukti & penggunaan ulang | A | Must | 2 |
| EP-08 | Temuan & tindak lanjut | A | Should | 2 |
| EP-09 | Portal auditor eksternal | A | Must | 2 |
| EP-10 | Registri aplikasi & pengambilan data akses | B | Must | 3 |
| EP-11 | Rekonsiliasi & deteksi akun berisiko | B | Must | 3 |
| EP-12 | Kampanye review & keputusan reviewer | B | Must | 3 |
| EP-13 | Pencabutan akses & verifikasi penutupan | B | Must | 3 |
| EP-14 | Pemisahan tugas (SoD) | B | Should | 3 |
| EP-15 | Dasbor & pelaporan | Lintas | Should | 2–3 |

---

### EP-01 — Fondasi identitas, peran & jejak audit

**US-X-01 · Masuk dengan akun perusahaan**
*Sebagai* karyawan, *saya ingin* masuk ke SIGAP memakai akun domain yang sudah saya miliki, *agar* saya tidak perlu mengingat kata sandi baru.

- Diberikan saya memiliki akun Active Directory aktif, ketika saya membuka SIGAP dan memasukkan kredensial domain, maka saya masuk dan melihat beranda sesuai peran saya.
- Diberikan akun saya dinonaktifkan di Active Directory, ketika saya mencoba masuk, maka akses ditolak dan percobaan tercatat pada jejak audit.
- Diberikan saya tidak beraktivitas selama 30 menit, ketika saya kembali, maka sesi berakhir dan saya diminta masuk kembali.
- **Prioritas:** Must · **Sasaran:** BR-X-01

**US-X-02 · Hak akses berbasis peran**
*Sebagai* administrator sistem, *saya ingin* memberikan peran kepada pengguna sesuai tanggung jawabnya, *agar* setiap orang hanya melihat dan mengubah yang menjadi haknya.

- Diberikan seorang pengguna berperan Reviewer saja, ketika ia membuka menu administrasi, maka menu tersebut tidak tampil dan akses langsung melalui URL ditolak.
- Diberikan satu pengguna dapat memegang lebih dari satu peran, ketika perannya digabungkan, maka hak akses yang berlaku adalah gabungan hak dari seluruh perannya.
- Diberikan perubahan peran dilakukan, ketika perubahan disimpan, maka tercatat siapa mengubah, kapan, dari apa menjadi apa.
- **Prioritas:** Must · **Sasaran:** BR-X-02

**US-X-03 · Jejak audit tak terhapus**
*Sebagai* auditor internal, *saya ingin* melihat riwayat lengkap setiap aksi pada objek apa pun, *agar* saya dapat menelusuri bagaimana kondisi sekarang terbentuk.

- Diberikan sebuah objek pernah diubah, ketika saya membuka riwayatnya, maka saya melihat daftar kronologis berisi aktor, waktu, aksi, nilai sebelum dan sesudah.
- Diberikan seseorang berperan administrator, ketika ia mencoba menghapus catatan jejak audit, maka operasi ditolak oleh sistem tanpa pengecualian.
- Diberikan catatan jejak audit disimpan, ketika integritasnya diperiksa, maka rantai keterkaitan antarcatatan dapat diverifikasi.
- **Prioritas:** Must · **Sasaran:** BR-X-03

**US-X-04 · Delegasi tugas saat berhalangan**
*Sebagai* manajer yang akan cuti, *saya ingin* mendelegasikan tugas persetujuan saya, *agar* proses tidak tertahan.

- Diberikan saya menetapkan pendelegasian untuk rentang tanggal tertentu, ketika periode itu tiba, maka tugas baru diteruskan ke penerima delegasi.
- Diberikan penerima delegasi mengambil keputusan, ketika keputusan tercatat, maka tercantum bahwa keputusan diambil atas nama saya melalui pendelegasian.
- Diberikan periode delegasi berakhir, ketika ada tugas baru, maka tugas kembali kepada saya.
- **Prioritas:** Should · **Sasaran:** BR-X-06

---

### EP-02 — Siklus hidup dokumen kebijakan

**US-C-01 · Menyusun dokumen baru**
*Sebagai* pemilik proses, *saya ingin* menyusun draf SOP di dalam sistem, *agar* proses pengesahannya tercatat sejak awal.

- Diberikan saya berperan Penyusun Dokumen, ketika saya membuat dokumen baru, maka saya mengisi judul, jenis, unit pemilik, klasifikasi, dan mengunggah berkas atau menulis isi.
- Diberikan klasifikasi belum dipilih, ketika saya menyimpan, maka sistem menolak dan meminta klasifikasi ditetapkan.
- Diberikan dokumen berstatus Draf, ketika dicari oleh karyawan umum, maka dokumen tidak muncul di hasil pencarian.
- **Prioritas:** Must · **Sasaran:** BR-C-05

**US-C-02 · Alur persetujuan berjenjang**
*Sebagai* Compliance Officer, *saya ingin* dokumen melewati penelaahan dan pengesahan berjenjang, *agar* pengesahannya sah dan dapat dibuktikan.

- Diberikan draf diajukan, ketika saya mengirimnya untuk ditelaah, maka penelaah menerima notifikasi dan dokumen berstatus Dalam Penelaahan.
- Diberikan penelaah memberi komentar penolakan, ketika keputusan disimpan, maka dokumen kembali ke penyusun dengan komentar terlampir.
- Diberikan seluruh pengesah menyetujui, ketika pengesahan terakhir selesai, maka dokumen berstatus Disahkan dan menunggu tanggal berlaku.
- Diberikan tanggal berlaku tiba, ketika sistem memproses penjadwalan, maka dokumen berstatus Berlaku dan versi sebelumnya berstatus Digantikan.
- **Prioritas:** Must · **Sasaran:** BR-C-05

**US-C-03 · Versi & riwayat dokumen**
*Sebagai* auditor, *saya ingin* melihat versi dokumen yang berlaku pada tanggal tertentu di masa lalu, *agar* saya dapat menilai kepatuhan pada periode tersebut.

- Diberikan sebuah dokumen memiliki beberapa versi, ketika saya memilih tanggal rujukan, maka sistem menampilkan versi yang berlaku pada tanggal itu.
- Diberikan versi lama telah digantikan, ketika saya membukanya, maka tampil penanda jelas bahwa versi tersebut tidak lagi berlaku beserta tautan ke versi terbaru.
- Diberikan dua versi dipilih, ketika saya meminta perbandingan, maka sistem menampilkan perbedaan isinya.
- **Prioritas:** Must · **Sasaran:** BR-C-03

**US-C-04 · Tinjauan berkala otomatis**
*Sebagai* pemilik dokumen, *saya ingin* diingatkan sebelum dokumen saya kedaluwarsa, *agar* tidak ada SOP yang lewat masa tinjauannya.

- Diberikan dokumen memiliki siklus tinjauan 12 bulan, ketika tersisa 60 hari menuju jatuh tempo, maka pemilik menerima notifikasi pertama.
- Diberikan pengingat diabaikan, ketika tersisa 30, 14, dan 7 hari, maka pengingat berulang dikirim dan atasan pemilik disertakan pada pengingat terakhir.
- Diberikan tanggal tinjauan terlewat, ketika sistem memproses harian, maka dokumen ditandai Terlambat Ditinjau dan muncul pada dasbor kepatuhan.
- **Prioritas:** Must · **Sasaran:** BR-C-06

**US-C-05 · Penarikan dokumen**
*Sebagai* pemilik dokumen, *saya ingin* menarik dokumen yang sudah tidak relevan, *agar* tidak lagi dijadikan acuan.

- Diberikan dokumen berstatus Berlaku, ketika saya menariknya dengan alasan tercatat dan persetujuan, maka status menjadi Ditarik dan tidak muncul pada pencarian umum.
- Diberikan dokumen ditarik, ketika auditor mencarinya dengan filter khusus, maka dokumen tetap dapat diakses untuk keperluan audit.
- **Prioritas:** Must · **Sasaran:** BR-C-03

---

### EP-03 — Pencarian & jawaban berbasis kebijakan

**US-C-06 · Pencarian dengan bahasa sehari-hari**
*Sebagai* karyawan, *saya ingin* mencari aturan menggunakan kata-kata saya sendiri, *agar* saya tidak perlu menebak judul dokumen.

- Diberikan saya mengetik "batas transaksi harian nasabah baru", ketika saya menekan cari, maka hasil relevan tampil walaupun dokumen tidak memakai frasa persis itu.
- Diberikan hasil ditampilkan, ketika saya melihatnya, maka setiap hasil menampilkan judul, unit pemilik, tanggal berlaku, dan cuplikan bagian yang cocok.
- Diberikan saya menambahkan filter unit kerja dan jenis dokumen, ketika filter diterapkan, maka hasil menyempit sesuai filter.
- Diberikan pencarian tidak menemukan apa pun, ketika hasil kosong, maka sistem menyarankan kata kunci alternatif dan menawarkan mengajukan pertanyaan ke unit pemilik.
- **Prioritas:** Must · **Sasaran:** BR-C-01

**US-C-07 · Hasil pencarian menghormati hak akses**
*Sebagai* pemilik dokumen rahasia, *saya ingin* dokumen saya tidak muncul pada pencarian orang yang tidak berhak, *agar* kerahasiaannya terjaga.

- Diberikan sebuah dokumen berklasifikasi Rahasia dan dibatasi untuk unit tertentu, ketika karyawan di luar unit itu mencari, maka dokumen tidak muncul dalam bentuk apa pun, termasuk judulnya.
- Diberikan penyaringan hak akses dilakukan, ketika hasil dihitung, maka penyaringan terjadi sebelum peringkat disusun sehingga jumlah hasil tidak membocorkan keberadaan dokumen.
- **Prioritas:** Must · **Sasaran:** BR-C-02

**US-C-08 · Jawaban ringkas dengan rujukan**
*Sebagai* karyawan, *saya ingin* mendapat jawaban langsung atas pertanyaan saya beserta rujukan pasalnya, *agar* saya dapat memverifikasi sendiri kebenarannya.

- Diberikan saya mengajukan pertanyaan, ketika sistem menemukan bagian dokumen yang relevan, maka tampil jawaban ringkas disertai daftar rujukan berisi nama dokumen, versi, dan nomor bagian yang dapat diklik.
- Diberikan jawaban ditampilkan, ketika saya membacanya, maka terdapat pernyataan bahwa dokumen sumber merupakan acuan yang mengikat.
- Diberikan sistem tidak menemukan dasar yang cukup, ketika jawaban akan dibentuk, maka sistem menyatakan tidak menemukan dasar dan hanya menampilkan hasil pencarian biasa.
- Diberikan seluruh dokumen relevan berklasifikasi Terbatas atau Rahasia, ketika saya mengajukan pertanyaan, maka fitur jawaban otomatis tidak dijalankan dan sistem menjelaskan alasannya, sambil tetap menampilkan tautan dokumen bila saya berhak membacanya.
- **Prioritas:** Should · **Sasaran:** BR-C-04, BR-C-08

**US-C-09 · Kendali keluarnya data ke layanan eksternal**
*Sebagai* Compliance Officer, *saya ingin* memastikan hanya dokumen berklasifikasi rendah yang diproses layanan eksternal, *agar* risiko kebocoran terkendali.

- Diberikan gerbang klasifikasi aktif, ketika permintaan jawaban otomatis diproses, maka hanya potongan dokumen berklasifikasi Publik dan Internal yang dikirim keluar.
- Diberikan potongan dokumen akan dikirim, ketika proses redaksi berjalan, maka pola data pribadi seperti NIK, nomor rekening, dan nomor telepon disamarkan.
- Diberikan permintaan telah diproses, ketika saya membuka catatan gerbang, maka saya melihat siapa bertanya, dokumen apa yang dirujuk, dan apa yang dikirim keluar.
- Diberikan saya mengaktifkan pemutus layanan, ketika ada permintaan baru, maka fitur jawaban otomatis nonaktif seketika tanpa mengganggu pencarian biasa.
- **Prioritas:** Must · **Sasaran:** BR-C-08, BR-X-05

---

### EP-04 — Attestation kebijakan

**US-C-10 · Kampanye pernyataan telah membaca**
*Sebagai* Compliance Officer, *saya ingin* mewajibkan kelompok karyawan tertentu menyatakan telah membaca kebijakan tertentu, *agar* pemahaman kebijakan dapat dibuktikan.

- Diberikan saya membuat kampanye attestation, ketika saya memilih dokumen dan kelompok sasaran berdasarkan unit atau jabatan, maka sistem membentuk daftar tugas untuk setiap sasaran.
- Diberikan karyawan menerima tugas, ketika ia membuka dokumen dan menekan pernyataan, maka tercatat identitas, waktu, versi dokumen yang dibaca, dan alamat IP.
- Diberikan karyawan belum menyatakan sampai tenggat, ketika tenggat terlewat, maka pengingat dikirim dan atasan langsungnya disertakan.
- Diberikan kampanye berjalan, ketika saya membuka pemantauannya, maka saya melihat persentase penyelesaian per unit kerja.
- **Prioritas:** Must · **Sasaran:** BR-C-07

---

### EP-05 — Control library & pemetaan framework

**US-A-01 · Pustaka kontrol terpusat**
*Sebagai* auditor internal, *saya ingin* memelihara satu daftar kontrol perusahaan, *agar* setiap penugasan memakai definisi kontrol yang sama.

- Diberikan saya berperan Pengelola Kontrol, ketika saya menambah kontrol, maka saya mengisi kode, uraian, pemilik kontrol, frekuensi, dan jenis pengujian.
- Diberikan kontrol sudah dipakai pada penugasan, ketika saya mengubah uraiannya, maka perubahan tersimpan sebagai versi baru tanpa mengubah kertas kerja yang sudah selesai.
- **Prioritas:** Must · **Sasaran:** BR-A-01

**US-A-02 · Pemetaan satu kontrol ke banyak framework**
*Sebagai* Compliance Officer, *saya ingin* memetakan satu kontrol ke beberapa ketentuan sekaligus, *agar* satu pengujian memenuhi banyak kewajiban.

- Diberikan sebuah kontrol, ketika saya memetakannya ke POJK, ISO 27001, dan kebijakan internal, maka seluruh pemetaan tersimpan dan terlihat pada tampilan kontrol.
- Diberikan saya membuka tampilan framework, ketika saya memilih satu ketentuan, maka saya melihat kontrol mana saja yang menutupinya dan mana yang belum tertutup sama sekali.
- **Prioritas:** Must · **Sasaran:** BR-A-03

---

### EP-06 — Penugasan audit & permintaan bukti

**US-A-03 · Membuat penugasan audit**
*Sebagai* auditor internal, *saya ingin* membuat penugasan dengan cakupan, periode, dan tim, *agar* seluruh aktivitas terkumpul dalam satu wadah.

- Diberikan saya membuat penugasan, ketika saya menentukan jenis, periode, unit yang diaudit, dan anggota tim, maka penugasan terbentuk dengan status Perencanaan.
- Diberikan penugasan dibuat dari templat, ketika templat dipilih, maka daftar kontrol dan permintaan bukti standar terisi otomatis.
- **Prioritas:** Must · **Sasaran:** BR-A-01

**US-A-04 · Daftar permintaan bukti dengan tenggat**
*Sebagai* auditor internal, *saya ingin* menerbitkan daftar permintaan bukti kepada PIC yang tepat, *agar* saya tidak perlu menagih satu per satu.

- Diberikan penugasan aktif, ketika saya menambahkan permintaan bukti, maka saya menentukan uraian, kontrol terkait, PIC, dan tenggat.
- Diberikan permintaan diterbitkan, ketika penerbitan selesai, maka setiap PIC menerima notifikasi berisi daftar tugasnya sendiri, bukan seluruh daftar.
- Diberikan tenggat mendekat, ketika tersisa 3 hari, maka pengingat otomatis dikirim; ketika tenggat terlewat, maka eskalasi dikirim ke atasan PIC.
- **Prioritas:** Must · **Sasaran:** BR-A-04

**US-A-05 · Memenuhi permintaan bukti**
*Sebagai* PIC unit, *saya ingin* melihat seluruh permintaan yang ditujukan kepada saya dalam satu daftar, *agar* saya tidak kehilangan jejak.

- Diberikan saya membuka daftar tugas saya, ketika daftar tampil, maka saya melihat permintaan dari seluruh penugasan yang aktif, terurut berdasarkan tenggat.
- Diberikan saya memenuhi permintaan, ketika saya mengunggah berkas atau memilih bukti yang sudah ada, maka status permintaan berubah menjadi Diserahkan.
- Diberikan bukti saya ditolak auditor, ketika penolakan tercatat, maka saya menerima notifikasi berisi alasan dan permintaan kembali terbuka.
- **Prioritas:** Must · **Sasaran:** BR-A-01

---

### EP-07 — Pengelolaan bukti & penggunaan ulang

**US-A-06 · Keaslian bukti dapat dibuktikan**
*Sebagai* auditor eksternal, *saya ingin* memastikan berkas bukti tidak berubah sejak diserahkan, *agar* saya dapat mengandalkannya.

- Diberikan sebuah berkas diunggah, ketika unggahan selesai, maka sistem menghitung sidik jari kriptografis berkas dan menyimpannya bersama identitas pengunggah dan waktu.
- Diberikan berkas perlu diperbarui, ketika berkas baru diunggah pada bukti yang sama, maka terbentuk versi baru dan versi lama tetap tersimpan utuh.
- Diberikan saya mengunduh bukti, ketika unduhan selesai, maka saya memperoleh keterangan sidik jari dan riwayat kepemilikan berkas tersebut.
- **Prioritas:** Must · **Sasaran:** BR-A-02

**US-A-07 · Menggunakan ulang bukti yang sudah ada**
*Sebagai* PIC unit, *saya ingin* menautkan bukti yang pernah saya serahkan ke permintaan baru, *agar* saya tidak mengunggah berkas yang sama berulang kali.

- Diberikan saya memenuhi permintaan baru, ketika saya mencari pada pustaka bukti, maka saya melihat bukti yang pernah diserahkan beserta periode keberlakuannya.
- Diberikan saya menautkan bukti lama, ketika penautan tersimpan, maka satu bukti terhubung ke beberapa permintaan dan kontrol sekaligus.
- Diberikan bukti memiliki masa berlaku, ketika masa berlaku telah lewat, maka sistem menandainya kedaluwarsa dan mencegah penautan baru tanpa persetujuan auditor.
- **Prioritas:** Must · **Sasaran:** BR-A-03

**US-A-08 · Penelaahan bukti oleh auditor**
*Sebagai* auditor internal, *saya ingin* menelaah dan memutuskan bukti yang masuk, *agar* status kesiapan penugasan selalu akurat.

- Diberikan bukti berstatus Diserahkan, ketika saya menelaahnya, maka saya dapat menerima, menolak dengan alasan, atau meminta tambahan.
- Diberikan saya menerima bukti, ketika keputusan tersimpan, maka permintaan terkait berstatus Selesai dan berkontribusi pada persentase kesiapan penugasan.
- **Prioritas:** Must · **Sasaran:** BR-A-01

**US-A-09 · Retensi & penahanan hukum**
*Sebagai* Compliance Officer, *saya ingin* menetapkan masa simpan bukti dan menahan penghapusannya bila diperlukan, *agar* perusahaan patuh sekaligus terlindungi.

- Diberikan kebijakan retensi 10 tahun ditetapkan, ketika masa simpan berakhir, maka bukti masuk antrean penghapusan dan menunggu persetujuan sebelum benar-benar dihapus.
- Diberikan penahanan hukum diberlakukan pada suatu penugasan, ketika masa retensi berakhir, maka penghapusan tidak dijalankan sampai penahanan dicabut.
- **Prioritas:** Must · **Sasaran:** BR-A-07

---

### EP-08 — Temuan & tindak lanjut

**US-A-10 · Mencatat temuan**
*Sebagai* auditor internal, *saya ingin* mencatat temuan beserta bukti pendukungnya, *agar* laporan tersusun dari sumber yang dapat ditelusuri.

- Diberikan pengujian kontrol selesai, ketika saya membuat temuan, maka saya mengisi uraian, tingkat risiko, kontrol terdampak, dan menautkan bukti pendukung.
- Diberikan temuan dibuat, ketika saya menetapkan pemilik tindak lanjut dan tenggat, maka pemilik menerima notifikasi.
- **Prioritas:** Should · **Sasaran:** BR-A-06

**US-A-11 · Memantau tindak lanjut**
*Sebagai* Kepala SKAI, *saya ingin* memantau seluruh tindak lanjut terbuka, *agar* temuan tidak menguap.

- Diberikan terdapat temuan terbuka, ketika saya membuka pemantauan, maka saya melihat seluruhnya beserta umur, status, dan pemiliknya.
- Diberikan pemilik menyerahkan bukti perbaikan, ketika saya memverifikasi dan menerima, maka temuan berstatus Ditutup beserta bukti penutupnya.
- Diberikan tenggat tindak lanjut terlewat, ketika sistem memproses harian, maka eskalasi dikirim sesuai tingkat risiko temuan.
- **Prioritas:** Should · **Sasaran:** BR-A-06

---

### EP-09 — Portal auditor eksternal

**US-A-12 · Akses terbatas untuk auditor eksternal**
*Sebagai* koordinator audit, *saya ingin* memberi auditor eksternal akses hanya pada bukti yang relevan dan hanya selama periode pemeriksaan, *agar* tidak ada paparan berlebih.

- Diberikan saya mengundang auditor eksternal, ketika saya menentukan penugasan dan tanggal berakhir akses, maka auditor menerima undangan dan hanya dapat melihat penugasan tersebut.
- Diberikan auditor eksternal masuk, ketika ia menjelajah sistem, maka ia hanya melihat bukti yang telah diterima pada penugasannya, tanpa akses ke modul lain.
- Diberikan tanggal berakhir tiba, ketika auditor mencoba masuk, maka akses ditolak secara otomatis.
- Diberikan auditor mengunduh berkas, ketika unduhan terjadi, maka aktivitas tercatat pada jejak audit dan terlihat oleh koordinator.
- **Prioritas:** Must · **Sasaran:** BR-A-05

---

### EP-10 — Registri aplikasi & pengambilan data akses

**US-B-01 · Registri aplikasi**
*Sebagai* IT Security Officer, *saya ingin* memelihara daftar aplikasi beserta pemilik dan kekritisannya, *agar* cakupan review jelas.

- Diberikan saya menambah aplikasi, ketika saya mengisi nama, pemilik aplikasi, tingkat kekritisan, jenis data, dan cara pengambilan data akses, maka aplikasi terdaftar.
- Diberikan sebuah aplikasi berkekritisan tinggi, ketika kampanye dijadwalkan, maka sistem menyarankan frekuensi review yang lebih sering.
- **Prioritas:** Must · **Sasaran:** BR-B-01

**US-B-02 · Pengambilan data otomatis melalui konektor**
*Sebagai* IT Security Officer, *saya ingin* menarik data pengguna dan hak akses secara terjadwal dari aplikasi yang mendukung, *agar* datanya selalu mutakhir tanpa campur tangan manusia.

- Diberikan konektor Active Directory dikonfigurasi, ketika jadwal harian berjalan, maka data pengguna, grup, dan keanggotaan tertarik dan tersimpan sebagai snapshot bertanggal.
- Diberikan konektor gagal berjalan, ketika kegagalan terjadi, maka notifikasi dikirim ke IT Security dan snapshot terakhir yang berhasil tetap dipakai.
- Diberikan konektor berjalan, ketika data ditarik, maka koneksi bersifat hanya-baca dan kredensialnya tidak pernah tampil di antarmuka.
- **Prioritas:** Must · **Sasaran:** BR-B-02

**US-B-03 · Unggah data akses melalui berkas**
*Sebagai* application owner aplikasi lama, *saya ingin* mengunggah daftar pengguna dalam berkas, *agar* aplikasi saya tetap tercakup meski tidak punya API.

- Diberikan saya membuka halaman unggah, ketika saya mengunduh templat, maka templat berisi kolom wajib beserta penjelasan dan contoh baris.
- Diberikan saya mengunggah berkas, ketika sistem memvalidasi, maka saya melihat pratinjau berisi jumlah baris valid dan daftar baris bermasalah beserta nomor baris dan alasannya.
- Diberikan terdapat baris bermasalah, ketika saya memilih melanjutkan, maka hanya baris valid yang diproses dan baris bermasalah dapat saya unduh untuk diperbaiki.
- Diberikan unggahan diterima, ketika proses selesai, maka terbentuk snapshot bertanggal dan tercatat siapa mengunggah.
- **Prioritas:** Must · **Sasaran:** BR-B-02

---

### EP-11 — Rekonsiliasi & deteksi akun berisiko

**US-B-04 · Deteksi akun karyawan yang sudah berhenti**
*Sebagai* IT Security Officer, *saya ingin* sistem menyandingkan data akses dengan data kepegawaian, *agar* akun milik mantan karyawan segera ketahuan.

- Diberikan snapshot akses terbaru dan data kepegawaian tersedia, ketika rekonsiliasi berjalan, maka sistem menandai akun aktif yang pemiliknya berstatus tidak aktif.
- Diberikan akun ditandai, ketika saya membukanya, maka tampil nama karyawan, tanggal berhenti, aplikasi, dan hak akses yang masih melekat.
- Diberikan temuan bersifat sah karena alasan tertentu, ketika saya mencatat pengecualian dengan alasan dan tanggal peninjauan ulang, maka temuan tidak muncul lagi sampai tanggal tersebut.
- **Prioritas:** Must · **Sasaran:** BR-B-03

**US-B-05 · Deteksi akun tanpa pemilik dan akun tidak aktif**
*Sebagai* IT Security Officer, *saya ingin* menemukan akun yang tidak dapat dikaitkan dengan karyawan mana pun serta akun yang lama tidak dipakai, *agar* permukaan serangan mengecil.

- Diberikan sebuah akun tidak dapat dipetakan ke karyawan, ketika rekonsiliasi berjalan, maka akun ditandai sebagai tanpa pemilik dan diarahkan ke pemilik aplikasi untuk ditelusuri.
- Diberikan aplikasi menyediakan data waktu akses terakhir, ketika akun tidak dipakai melebihi ambang yang ditetapkan, maka akun ditandai tidak aktif.
- **Prioritas:** Must · **Sasaran:** BR-B-03

---

### EP-12 — Kampanye review & keputusan reviewer

**US-B-06 · Menyusun kampanye review**
*Sebagai* IT Security Officer, *saya ingin* menyusun kampanye dengan cakupan dan reviewer yang ditentukan aturan, *agar* saya tidak menugaskan orang satu per satu.

- Diberikan saya membuat kampanye, ketika saya memilih aplikasi, periode, dan aturan penugasan reviewer, maka sistem menampilkan pratinjau berisi jumlah item dan sebaran reviewer.
- Diberikan aturan penugasan berbasis atasan langsung, ketika seorang karyawan tidak memiliki atasan pada data kepegawaian, maka item diarahkan ke reviewer cadangan dan ditandai untuk perhatian.
- Diberikan kampanye dijalankan, ketika peluncuran selesai, maka setiap reviewer menerima notifikasi berisi jumlah item dan tenggatnya.
- **Prioritas:** Must · **Sasaran:** BR-B-04

**US-B-07 · Memutuskan hak akses**
*Sebagai* manajer lini, *saya ingin* menelaah hak akses anak buah saya dengan konteks yang cukup, *agar* keputusan saya berdasar.

- Diberikan saya membuka daftar tugas review, ketika daftar tampil, maka setiap baris memuat nama karyawan, jabatan, aplikasi, hak akses, **penjelasan hak akses dalam bahasa non-teknis**, waktu akses terakhir, dan penanda risiko.
- Diberikan saya belum memutuskan, ketika baris ditampilkan, maka tidak ada pilihan yang terpilih otomatis.
- Diberikan saya memilih Cabut atau Ubah, ketika saya menyimpan tanpa mengisi alasan, maka sistem menolak dan meminta alasan diisi.
- Diberikan sebuah hak akses ditandai berisiko tinggi, ketika saya memilih Pertahankan, maka sistem meminta konfirmasi tambahan berisi alasan.
- Diberikan saya memilih beberapa baris sekaligus, ketika saya menerapkan keputusan massal, maka baris berisiko tinggi dikecualikan dan harus diputuskan satu per satu.
- **Prioritas:** Must · **Sasaran:** BR-B-05, BR-B-06

**US-B-08 · Sign-off kampanye**
*Sebagai* application owner, *saya ingin* menandatangani hasil review secara elektronik, *agar* pertanggungjawaban saya tercatat sah.

- Diberikan seluruh item pada cakupan saya telah diputuskan, ketika saya melakukan sign-off, maka sistem meminta autentikasi ulang sebelum menyimpan.
- Diberikan sign-off tersimpan, ketika tercatat, maka memuat identitas, waktu, alamat IP, ringkasan jumlah keputusan, dan sidik jari isi yang ditandatangani.
- Diberikan masih ada item belum diputuskan, ketika saya mencoba sign-off, maka sistem menolak dan menunjukkan item yang tertinggal.
- **Prioritas:** Must · **Sasaran:** BR-B-05, BR-B-09

**US-B-09 · Memantau kemajuan kampanye**
*Sebagai* IT Security Officer, *saya ingin* memantau kemajuan tiap reviewer, *agar* saya dapat menagih yang tertinggal.

- Diberikan kampanye berjalan, ketika saya membuka pemantauan, maka saya melihat persentase penyelesaian per aplikasi dan per reviewer.
- Diberikan reviewer belum bergerak sampai setengah periode, ketika ambang terlewat, maka pengingat otomatis dikirim; mendekati tenggat, eskalasi dikirim ke atasannya.
- Diberikan seorang reviewer menyetujui seluruh itemnya dalam waktu yang tidak wajar singkat, ketika pola terdeteksi, maka kampanye menandainya untuk uji petik oleh SKAI.
- **Prioritas:** Should · **Sasaran:** BR-B-06

---

### EP-13 — Pencabutan akses & verifikasi penutupan

**US-B-10 · Tiket pencabutan**
*Sebagai* IT Security Officer, *saya ingin* setiap keputusan cabut menghasilkan tiket yang terpantau, *agar* tidak ada yang terlewat dieksekusi.

- Diberikan keputusan Cabut tersimpan dan kampanye ditandatangani, ketika proses penutupan berjalan, maka terbentuk tiket pencabutan berisi identitas, aplikasi, hak akses, dan pelaksana.
- Diberikan tiket terbentuk, ketika pelaksana menyelesaikannya, maka ia menandai selesai disertai keterangan pelaksanaan.
- Diberikan tiket melewati SLA, ketika ambang terlewat, maka eskalasi dikirim ke pemilik aplikasi dan IT Security.
- **Prioritas:** Must · **Sasaran:** BR-B-07

**US-B-11 · Verifikasi pencabutan pada data berikutnya**
*Sebagai* IT Security Officer, *saya ingin* sistem membuktikan sendiri bahwa akses benar-benar sudah tidak ada, *agar* saya tidak bergantung pada klaim pelaksana.

- Diberikan tiket ditandai selesai, ketika snapshot berikutnya dari aplikasi tersebut masuk, maka sistem memeriksa apakah hak akses itu masih ada.
- Diberikan hak akses ternyata masih ada, ketika pemeriksaan selesai, maka tiket dibuka kembali, ditandai Gagal Diverifikasi, dan dieskalasi.
- Diberikan hak akses sudah tidak ada, ketika pemeriksaan selesai, maka tiket berstatus Terverifikasi Tertutup dan menjadi bagian paket bukti kampanye.
- **Prioritas:** Must · **Sasaran:** BR-B-07

**US-B-12 · Paket bukti kampanye**
*Sebagai* auditor internal, *saya ingin* menerima seluruh hasil kampanye sebagai satu bukti utuh, *agar* saya tidak menyusunnya secara manual.

- Diberikan kampanye selesai dan seluruh sign-off diperoleh, ketika saya meminta paket bukti, maka sistem menghasilkan berkas berisi cakupan, seluruh keputusan beserta alasan, catatan sign-off, dan status pencabutan.
- Diberikan paket terbentuk, ketika proses selesai, maka paket otomatis tersimpan sebagai bukti pada Modul A dan tertaut ke kontrol akses yang relevan.
- **Prioritas:** Must · **Sasaran:** BR-B-09

---

### EP-14 — Pemisahan tugas (SoD)

**US-B-13 · Aturan konflik pemisahan tugas**
*Sebagai* Compliance Officer, *saya ingin* menetapkan kombinasi akses yang tidak boleh dipegang satu orang, *agar* risiko kecurangan berkurang.

- Diberikan saya membuat aturan konflik, ketika saya memilih dua kelompok hak akses yang tidak boleh bersamaan dan tingkat risikonya, maka aturan tersimpan.
- Diberikan snapshot baru masuk, ketika evaluasi berjalan, maka seluruh pelanggaran aturan terdaftar beserta identitas dan hak akses yang berkonflik.
- Diberikan sebuah konflik terdeteksi, ketika kampanye berjalan, maka item terkait ditandai dan reviewer melihat peringatan konflik pada barisnya.
- Diberikan konflik tidak dapat dihindari karena keterbatasan personel, ketika pengecualian diajukan dan disetujui pejabat berwenang dengan kontrol kompensasi tercatat, maka konflik ditandai Dikecualikan sampai tanggal peninjauan ulang.
- **Prioritas:** Should · **Sasaran:** BR-B-08

---

### EP-15 — Dasbor & pelaporan

**US-X-05 · Dasbor kepatuhan eksekutif**
*Sebagai* Direktur Kepatuhan, *saya ingin* melihat kondisi kepatuhan terkini dalam satu halaman, *agar* saya siap menghadapi pertanyaan kapan pun.

- Diberikan saya membuka dasbor, ketika halaman tampil, maka saya melihat status penugasan audit berjalan, kesiapan bukti, kemajuan kampanye review, temuan terbuka menurut tingkat risiko, dokumen terlambat ditinjau, dan tingkat penyelesaian attestation.
- Diberikan sebuah indikator menunjukkan kondisi buruk, ketika saya menekannya, maka saya masuk ke daftar rinci penyebabnya.
- **Prioritas:** Should · **Sasaran:** BR-X-04

**US-X-06 · Laporan siap serah**
*Sebagai* Compliance Officer, *saya ingin* menghasilkan laporan standar dalam format yang dapat diserahkan, *agar* saya tidak menyusun ulang di lembar kerja.

- Diberikan saya memilih jenis laporan dan periode, ketika saya menjalankan pembuatan laporan, maka proses berjalan di latar belakang dan saya diberi tahu ketika siap.
- Diberikan laporan siap, ketika saya mengunduhnya, maka tersedia dalam format PDF dan lembar kerja, memuat identitas pembuat, waktu pembuatan, dan parameter yang dipakai.
- **Prioritas:** Should · **Sasaran:** BR-X-04

---

## 5. Prioritisasi MoSCoW & Rencana Rilis

| Fase | Isi | Epic | Kriteria peluncuran |
|---|---|---|---|
| **Fase 1** — Fondasi & Policy Hub | Autentikasi AD, peran, jejak audit, siklus hidup dokumen, pencarian hibrida, jawaban ber-sitasi, attestation | EP-01, EP-02, EP-03, EP-04 | 200 dokumen prioritas termigrasi; pencarian mengembalikan hasil relevan pada 20 pertanyaan uji; gerbang klasifikasi teruji |
| **Fase 2** — Evidence Vault | Control library, penugasan, PBC, bukti & penggunaan ulang, temuan, portal auditor | EP-05, EP-06, EP-07, EP-08, EP-09, EP-15 (sebagian) | Satu penugasan audit internal nyata berjalan penuh tanpa email |
| **Fase 3** — Access Review | Registri aplikasi, konektor & unggah, rekonsiliasi, kampanye, keputusan, pencabutan & verifikasi, SoD | EP-10 s.d. EP-14, EP-15 (lengkap) | Satu siklus UAR pada 5 aplikasi kritis selesai ≤10 hari kerja dengan paket bukti terbentuk otomatis |

### Rincian MoSCoW

**Must Have** — seluruh cerita berlabel Must pada §4. Tanpa ini produk tidak memenuhi kewajiban regulasi maupun tujuan bisnis.

**Should Have** — US-X-04 (delegasi), US-A-10 & US-A-11 (temuan & tindak lanjut), US-B-09 (pemantauan kampanye), US-B-13 (SoD), US-C-08 (jawaban otomatis), US-X-05 & US-X-06 (dasbor & laporan).

**Could Have** — kandidat rilis lanjutan, tidak dirancang detail pada versi ini:

- Aplikasi seluler khusus untuk persetujuan.
- Tanda tangan digital bersertifikat untuk sign-off.
- Analitik pola keputusan reviewer lintas siklus.
- Rekomendasi hak akses berbasis kemiripan peran (*role mining*).
- Integrasi dua arah dengan sistem tiket layanan TI.
- Portal mandiri bagi karyawan untuk mengajukan permintaan akses baru.

**Won't Have (versi ini)** — penyediaan/pencabutan akses otomatis ke aplikasi target, manajemen risiko perusahaan, penilaian risiko pihak ketiga, manajemen pelatihan, SIEM. Alasan tercantum pada [01-BRD.md §6.2](01-BRD.md).

---

## 6. Metrik Keberhasilan Produk

### 6.1 Metrik adopsi

| Metrik | Target 3 bulan pasca-fase |
|---|---|
| Pengguna aktif mingguan terhadap total karyawan | ≥ 60% (didorong Modul C) |
| Rata-rata pencarian per pengguna aktif per minggu | ≥ 2 |
| Persentase permintaan bukti dipenuhi melalui sistem, bukan email | ≥ 95% |
| Persentase kampanye review yang selesai tanpa perpanjangan tenggat | ≥ 80% |

### 6.2 Metrik kualitas pengalaman

| Metrik | Target |
|---|---|
| Tingkat keberhasilan tugas pada uji kegunaan reviewer | ≥ 90% menyelesaikan review tanpa bantuan |
| Waktu penyelesaian review 20 item oleh manajer lini | ≤ 10 menit |
| Persentase pencarian yang berakhir dengan pembukaan dokumen (bukan ditinggalkan) | ≥ 65% |
| Persentase jawaban otomatis yang ditandai membantu oleh pengguna | ≥ 70% |
| Waktu unggah bukti sampai selesai (berkas 10 MB) | ≤ 15 detik |

### 6.3 Metrik yang sengaja tidak dipakai

- **Kecepatan reviewer menyelesaikan item** tidak dijadikan target untuk dimaksimalkan. Semakin cepat belum tentu semakin baik; kecepatan ekstrem justru indikator persetujuan asal-asalan.
- **Jumlah dokumen dalam sistem** bukan ukuran keberhasilan. Kualitas dan keberlakuan lebih penting daripada volume.

---

## 7. Non-Goals

Hal-hal berikut secara sadar **bukan** tujuan produk, dinyatakan agar tidak menyelinap masuk selama pengembangan:

1. **Bukan sistem penyediaan akses.** SIGAP mengetahui dan menilai akses, tidak memberikan atau mencabutnya secara langsung ke sistem target.
2. **Bukan tempat penyimpanan berkas umum.** Modul C hanya untuk dokumen normatif yang disahkan.
3. **Bukan pengganti pertimbangan profesional auditor.** Sistem menyusun bukti dan menyoroti anomali; kesimpulan audit tetap milik auditor.
4. **Bukan sumber kebenaran data kepegawaian.** Data karyawan tetap milik sistem HR; SIGAP mengonsumsinya.
5. **Bukan penasihat hukum.** Jawaban otomatis merangkum dokumen internal, bukan menafsirkan peraturan.
6. **Bukan alat pemantauan produktivitas karyawan.** Data aktivitas dipakai untuk jejak audit dan deteksi anomali kontrol, bukan untuk penilaian kinerja individu. Batasan ini ditegakkan melalui pembatasan peran atas laporan aktivitas.

---

## 8. Pertanyaan Terbuka

| # | Pertanyaan | Pemilik keputusan | Dibutuhkan sebelum |
|---|---|---|---|
| Q-01 | Apakah data kepegawaian dapat diambil langsung dari sistem HR, atau harus melalui berkas berkala? | HRD & TI | Fase 3 dimulai |
| Q-02 | Penyedia layanan LLM mana yang disetujui, dan apakah tersedia opsi endpoint regional dengan perjanjian tanpa retensi? | Kepatuhan & TI | Fase 1 dimulai |
| Q-03 | Berapa masa retensi bukti yang mengikat menurut ketentuan sektor efek — 5 atau 10 tahun? | Kepatuhan | Fase 2 dimulai |
| Q-04 | Apakah sign-off elektronik biasa memadai, atau diperlukan tanda tangan digital bersertifikat? | Kepatuhan & Hukum | Fase 3 dimulai |
| Q-05 | Aplikasi mana saja yang masuk 5 besar percontohan kampanye UAR? | IT Security | Fase 3 dimulai |
| Q-06 | Siapa yang berwenang menyetujui pengecualian konflik pemisahan tugas? | Direksi | Fase 3 dimulai |
| Q-07 | Apakah portal auditor eksternal boleh diakses dari luar jaringan perusahaan, atau hanya dari jaringan internal/VPN? | IT Security | Fase 2 dimulai |
| Q-08 | Apakah anak usaha — di antaranya PT Trimegah Asset Management — ikut memakai SIGAP? Bila ya, arsitektur perlu pemisahan data antar-entitas dan konsolidasi laporan tingkat grup | Direksi & TI | ~~Fase 1 dimulai~~ — **lihat catatan di bawah** |
| Q-09 | Aplikasi mana yang menjadi ruang lingkup awal: Trima+, sistem back office, kustodian, atau sistem fixed income? Kekritisan dan cara pengambilan data akses berbeda-beda | IT Security & Pemilik Aplikasi | Fase 3 dimulai |

### Catatan Q-08 — tidak lagi memblokir Fase 1

*Ditetapkan 27 Agustus 2026.*

Tabel ini semula menandai Q-08 harus dijawab **sebelum Fase 1 dimulai**, sementara [04-TRD §10](04-TRD.md) butir 6 sudah mencatat jawabannya sebagai keputusan lingkup yang diambil secara sadar: **satu badan hukum, tanpa pemisahan antar-entitas.** Kedua pernyataan itu bertentangan, dan pertentangannya menahan Fase 1 tanpa alasan.

**Yang berlaku: keputusan di TRD.** Fondasi Fase 1 dibangun untuk satu badan hukum. Tidak ada kolom entitas pada skema.

Ini **tidak** berarti Direksi sudah memutuskan bahwa anak usaha tidak akan ikut. Kepemilikan keputusan tetap pada Direksi & TI. Yang berubah hanya ini: pertanyaannya tidak lagi menghalangi pekerjaan, karena rancangan yang ada sudah memuat jawaban kerja beserta pemicu peninjauannya.

**Bila kelak Direksi memutuskan anak usaha ikut,** konsekuensinya tetap seperti tertulis di [01-BRD ASM-01](01-BRD.md): perubahan arsitektur, bukan penambahan fitur. Biayanya naik seiring banyaknya data yang sudah masuk — migrasi pemisahan entitas menyentuh setiap tabel berdata. Karena itu keputusan ini sebaiknya tetap dibawa ke Direksi lebih awal, meskipun tidak lagi menjadi penghalang.

---

*Dokumen terkait: [01-BRD.md](01-BRD.md) · [03-FRD.md](03-FRD.md) · [05-UIUX-FLOW.md](05-UIUX-FLOW.md)*
