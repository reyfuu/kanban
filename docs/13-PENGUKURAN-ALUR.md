# SIGAP — Pengukuran Kerumitan Alur

> Dokumen ini melaporkan hasil menempuh setiap alur dari ujung ke ujung melalui API yang benar-benar berjalan, bukan melalui potongan uji. Skripnya ada di `scripts/` dan dapat dijalankan ulang kapan saja.
>
> Pertanyaan yang dijawab: **apakah alurnya terlalu berbelit?** Ukurannya jumlah panggilan yang harus dilakukan manusia untuk menuntaskan satu pekerjaan.

---

## 1. Cara mengulang pengukuran

```bash
bun run dev:api          # API di :3001
bun run db:seed          # data demo
bash scripts/alur-e2e.sh       # lima alur ringkas, semua peran
bash scripts/alur-modul-a.sh   # rantai audit penuh
bash scripts/alur-modul-b.sh   # rantai review akses penuh
```

Setiap skrip mencetak status tiap panggilan dan menjumlahkan langkahnya. Panggilan yang **sengaja ditolak** ikut ditampilkan sebagai `NO`, karena penolakan itu bagian dari perilaku yang diuji.

---

## 2. Hasil pengukuran

### 2.1 Langkah per peran

| Peran | Pekerjaan | Langkah | Penilaian |
|---|---|---|---|
| Karyawan | Menyatakan telah membaca satu SOP | **3** | Sesuai |
| PIC Bukti | Memenuhi satu permintaan | **4** | Sesuai, setelah disederhanakan dari 5 |
| Auditor | Menyiapkan dan menelaah satu permintaan | **4** | Sesuai |
| Manajer / Pemilik aplikasi | Kampanye berisi *n* item | **n + 3** | Sesuai |
| Petugas Keamanan TI | Menyiapkan satu kampanye | **5** | Sesuai |

### 2.2 Rantai penuh

| Rantai | Panggilan | Keterangan |
|---|---|---|
| Modul A · penugasan sampai kesiapan 100% | 11 | termasuk satu siklus penolakan dan perbaikan |
| Modul B · kampanye sampai tiket terverifikasi | 20 | termasuk 4 keputusan item |

---

## 3. Yang disederhanakan

### 3.1 Mendaftarkan bukti dan menautkannya jadi satu

**Sebelum.** PIC memanggil `POST /evidence` untuk mendaftarkan bukti, lalu `POST /evidence/{id}/links` untuk menautkannya ke permintaan.

**Masalahnya bukan jumlah langkah.** Celah di antara dua panggilan itu adalah asal **40 bukti yatim** pada basis data demo: bukti yang ada, tidak memenuhi permintaan apa pun, dan terus muncul sebagai saran penggunaan ulang selamanya.

**Sesudah.** Tautan menyertai pendaftaran, keduanya ditulis dalam satu transaksi:

`POST /evidence` dengan badan:

```json
{
  "title": "Ekspor pengguna Back Office Juni 2026",
  "evidence_type": "LAPORAN_SISTEM",
  "classification": "INTERNAL",
  "source": "UNGGAHAN_MANUAL",
  "link": { "target_type": "REQUEST_ITEM", "target_id": "..." }
}
```

Sasaran yang tidak sah membatalkan seluruhnya. Membiarkan buktinya tertinggal hanyalah yatim yang sama lewat jalan lain.

Tetap opsional, karena auditor yang menyusun pustaka bukti sebelum ada permintaan memang menginginkan bukti tanpa sasaran.

### 3.2 Penyerahan kosong ditolak lebih awal

**Sebelum.** Permintaan bukti dapat diserahkan tanpa satu pun bukti terlampir, dan sistem menerimanya.

Akibatnya satu siklus telaah penuh terpakai untuk mencapai kesimpulan yang sudah diketahui sistem sejak awal: auditor menerima notifikasi, membuka permintaan, menemukan kosong, lalu menolaknya. Sementara itu persentase kesiapan pada FR-A-007 aturan 4 sempat menghitungnya sebagai pekerjaan yang telah diserahkan.

**Sesudah.** Penyerahan tanpa bukti ditolak seketika dengan keterangan yang menyebutkan apa yang kurang.

---

## 4. Yang TIDAK disederhanakan, dan alasannya

Empat titik gesekan terlihat seperti langkah berlebih, tetapi justru merupakan sumber nilai sistem ini. Menghapusnya akan menghemat satu klik dan membuang alasan keberadaan modulnya.

| Gesekan | Terlihat seperti | Sebenarnya |
|---|---|---|
| Sign-off memerlukan autentikasi ulang | Satu langkah tambahan | Diwajibkan FR-X-003. Mengunci keputusan sekumpulan orang adalah aksi yang tidak boleh terjadi karena layar tertinggal terbuka |
| Tombol attestation baru aktif setelah dokumen dibaca sampai bawah | Menghambat | Tanpa ini, pernyataan telah membaca tidak berarti apa-apa. Semua orang akan mengklik tanpa membaca |
| Tidak ada tombol menutup tiket pencabutan | Fitur yang hilang | Inti K-1. Pelaksana boleh menyatakan telah mengerjakan; hanya snapshot berikutnya yang boleh membuktikan |
| Tidak ada keputusan review yang tercentang bawaan | Memperlambat reviewer | FR-B-012 aturan 1. Bila ada nilai bawaan, mayoritas menerimanya begitu saja dan kampanye kehilangan nilainya sebagai kontrol |

**Pembeda antara gesekan yang baik dan yang buruk:** gesekan yang baik memaksa manusia membuat keputusan yang memang harus ia buat. Gesekan yang buruk memaksa manusia menyusun ulang pekerjaan yang sudah jelas maksudnya. Dua hal di bagian 3 adalah jenis kedua; empat hal di sini jenis pertama.

---

## 5. Bug yang ditemukan dengan menempuh alur

Ketiganya lolos dari 292 tes yang sebelumnya hijau. Semuanya hanya muncul ketika rantainya ditempuh utuh oleh akun sungguhan.

| Temuan | Akibatnya | Mengapa lolos |
|---|---|---|
| `EVIDENCE_PIC` tidak punya satu pun izin | Akun yang seluruh keberadaannya untuk menyediakan bukti tidak dapat mendaftarkan sekeping pun | Uji unit tidak pernah memuat katalog izin; uji integrasi menyusun sendiri principal-nya dengan izin apa pun yang dibutuhkan kasusnya |
| `SEC_OFFICER`, `APP_OWNER`, `LINE_MANAGER` tanpa izin baca Modul A | Matriks FRD memberi mereka akses baca, kode menolaknya | Sama seperti di atas |
| Kampanye attestation tidak pernah dibenihkan | Karyawan biasa tidak punya tugas apa pun, sehingga peran `EMPLOYEE` tampak hanya-baca | Tidak ada uji yang memeriksa bahwa peran dasar punya pekerjaan |

Ketiganya kini dikunci oleh `apps/api/test/authz-matrix.test.ts`, yang **membaca matriks hak akses langsung dari `03-FRD.md`** dan membandingkannya dengan katalog izin. Salinan kedua yang ditulis tangan hanya akan membuktikan dua salinan saling setuju; kegagalan ini justru lolos karena setiap uji menyediakan sendiri konteks yang dibutuhkannya.

---

## 6. Kesimpulan

**Alurnya tidak berbelit.** Setiap peran menyelesaikan pekerjaannya dalam tiga sampai lima langkah, dan satu-satunya alur yang tumbuh mengikuti data adalah keputusan review, yang memang harus satu keputusan per item.

Dua penyederhanaan yang dilakukan bukan tentang menghemat klik, melainkan tentang menutup keadaan yang salah: bukti yatim dan penyerahan kosong. Empat gesekan yang tersisa dipertahankan dengan sengaja, dan masing-masing dapat ditunjuk requirement-nya.

Rujukan lanjutan: [11-ALUR-SISTEM.md](11-ALUR-SISTEM.md) untuk diagram alurnya, [12-PANDUAN-SEDERHANA.md](12-PANDUAN-SEDERHANA.md) untuk penjelasan tanpa istilah teknis.
