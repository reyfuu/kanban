# DESIGN — Design System & Guideline UI
## SIGAP: Sistem Integrasi Governance, Akses, dan Prosedur

| | |
|---|---|
| **Dokumen** | Design System & UI Guideline |
| **Produk** | SIGAP v1.0 |
| **Perusahaan** | PT Trimegah Sekuritas Indonesia Tbk (TRIM) |
| **Versi dokumen** | 1.0 |
| **Tanggal** | 27 Agustus 2026 |
| **Audiens** | UI/UX Designer, Frontend Developer |
| **Dokumen induk** | [05-UIUX-FLOW.md](05-UIUX-FLOW.md) |
| **Klasifikasi** | Internal |

---

## 1. Filosofi Desain

### 1.1 Aplikasi ini sengaja tidak menyenangkan

SIGAP adalah perkakas kerja untuk orang yang mengambil keputusan dengan konsekuensi audit. Rancangannya mengikuti tiga sikap:

**Tenang, bukan menarik perhatian.** Palet netral mendominasi. Warna hanya muncul ketika membawa makna: status, tingkat risiko, atau kedekatan tenggat. Antarmuka yang berwarna-warni membuat peringatan yang benar-benar penting kehilangan daya.

**Padat, bukan longgar.** Auditor membandingkan 40 baris sekaligus. Kepadatan tinggi mengurangi penggulingan dan menjaga konteks. Ini bertentangan dengan tren desain konsumen, dan memang disengaja.

**Tanpa animasi dekoratif.** Gerakan hanya dipakai untuk menjelaskan hubungan sebab-akibat — panel yang terbuka dari tombol yang ditekan, baris yang menghilang setelah diputuskan. Gerakan yang tidak menjelaskan apa pun menambah waktu tunggu.

### 1.2 Yang dihindari

| Pola | Alasan dihindari |
|---|---|
| Bayangan tebal dan gradien | Menambah kebisingan visual pada layar yang sudah padat informasi |
| Ilustrasi pada keadaan kosong | Membuang ruang vertikal yang berharga; teks penjelas lebih berguna |
| Warna merek yang dominan **di area data** | Warna harus dicadangkan untuk makna. Merek diterapkan pada chrome — lihat [§2.0](#20-lapisan-brand-trimegah) |
| Ikon tanpa label | Ikon yang ambigu menimbulkan keraguan pada keputusan berkonsekuensi |
| Sudut sangat membulat | Membuat tabel terasa longgar dan menyulitkan penyejajaran |
| Mode gelap sebagai bawaan | Sebagian besar pengguna bekerja di kantor dengan pencahayaan terang; mode gelap tersedia sebagai pilihan |

---

## 2. Token Desain

### 2.0 Lapisan brand Trimegah

> **Status: menunggu brand guideline.** Nilai `--tri-*` di bawah adalah penampung, bukan warna resmi. Isi setelah menerima panduan merek dari tim brand Trimegah, lalu hapus catatan ini. Jangan menebak nilainya dari tangkapan layar situs — kesalahan warna merek pada dokumen resmi lebih mahal daripada penundaan.

Identitas Trimegah diterapkan pada **chrome**, bukan pada area data.

```css
:root {
  /* Merek — WAJIB diisi dari brand guideline resmi */
  --tri-primary:      /* navy korporat */;
  --tri-primary-dark: /* untuk keadaan tekan & mode gelap */;
  --tri-primary-tint: /* latar sangat muda untuk area terpilih */;
  --tri-accent:       /* aksen sekunder, bila ada */;
  --tri-on-primary:   /* teks di atas primary — wajib kontras ≥4,5:1 */;

  --tri-font-display: /* tipografi judul sesuai panduan */;
  --tri-font-body:    /* tipografi isi; boleh sama dengan --sg-font-sans */;
}
```

#### Batas penerapan

| Boleh memakai warna merek | Tidak boleh memakai warna merek |
|---|---|
| Bilah atas dan bilah sisi | Baris dan sel tabel |
| Layar masuk dan halaman kesalahan | Lencana status |
| Logo dan kop laporan cetak | Penanda tingkat risiko |
| Tombol tindakan utama | Kendali keputusan review |
| Keadaan terpilih pada navigasi | Pita peringatan dan galat |
| Halaman muka paket bukti | Diagram dan bagan |

**Alasannya bukan estetika, melainkan keselamatan operasional.** Prinsip [§1.1](#11-aplikasi-ini-sengaja-tidak-menyenangkan) menyatakan warna dicadangkan untuk makna. Bila navy merek muncul di dalam tabel, ia bersaing dengan lencana status dan penanda risiko, dan reviewer yang menelaah 400 item kehilangan isyarat visual yang justru paling ia butuhkan. Merek terasa di kerangka layar; makna tetap berkuasa di dalam data.

Kabar baiknya, netral yang sudah dipakai (`--color-sg-neutral-900: #0f172a`) adalah abu-abu kebiruan gelap, sehingga navy korporat umumnya menyatu tanpa perlu mengubah palet netral.

#### Aturan yang mengikat

1. **Kontras diperiksa, bukan diasumsikan.** Setiap pasangan `--tri-primary` dengan teks di atasnya wajib memenuhi 4,5:1. Bila warna merek resmi tidak memenuhi, gunakan varian gelapnya untuk latar teks dan catat penyimpangan itu pada dokumen — jangan menurunkan ambang kontras.
2. **Warna merek tidak boleh menjadi satu-satunya pembeda** untuk keadaan apa pun, sama seperti warna semantik.
3. **Mode gelap memakai `--tri-primary-dark`**, bukan mencerahkan `--tri-primary`. Navy yang dicerahkan cenderung bergeser ke ungu.
4. **Logo tidak diregangkan, diwarnai ulang, atau ditempatkan di atas latar yang tidak diizinkan** panduan merek. Aturan zona aman logo diikuti apa adanya.
5. **Portal auditor eksternal memakai kop merek penuh.** Di sanalah identitas perusahaan paling relevan — auditor perlu tahu dengan pasti sistem siapa yang ia akses.

#### Yang perlu ada di brand guideline

Bila berkasnya belum lengkap, minimal ini yang dibutuhkan sebelum §2.0 dapat difinalkan:

- Nilai heksadesimal warna primer, sekunder, dan aksen
- Nama tipografi judul dan isi, beserta bobot yang tersedia
- Berkas logo dalam SVG, versi terang dan gelap
- Aturan zona aman dan ukuran minimum logo
- Larangan penggunaan logo

Saat nilainya masuk, token warna merek dipindahkan ke `@theme` sebagai `--color-tri-*` mengikuti §2.1. Sampai itu terjadi, keduanya sengaja **tidak** berada di `@theme`: entri `@theme` tanpa nilai membangkitkan kelas utilitas rusak yang merender warna kosong tanpa memberi tanda apa pun.

### 2.1 Warna dasar

Netral abu-abu kebiruan dipilih karena tidak bersaing dengan warna semantik dan nyaman untuk penggunaan berjam-jam.

> **Awalan `--color-` bukan hiasan.** Tailwind v4 hanya membangkitkan kelas utilitas dari namespace yang dikenalinya, dan warna harus berada di `@theme` dengan awalan `--color-`. Dengan penamaan ini satu definisi melayani dua pemakaian — `bg-sg-danger-500` maupun `var(--color-sg-danger-500)` — tanpa lapisan pemetaan yang bisa lupa diperbarui. Token non-warna pada §2.5 sampai §2.7 tetap memakai nama `--sg-*` dan dipakai lewat `var()`.
>
> Nilai-nilai ini hidup di `apps/web/src/styles/tokens.css`. Bila berbeda, dokumen ini yang menang.

```css
@theme {
  /* Netral */
  --color-sg-neutral-0:   #ffffff;
  --color-sg-neutral-50:  #f8fafc;
  --color-sg-neutral-100: #f1f5f9;
  --color-sg-neutral-200: #e2e8f0;
  --color-sg-neutral-300: #cbd5e1;
  --color-sg-neutral-400: #94a3b8;
  --color-sg-neutral-500: #64748b;
  --color-sg-neutral-600: #475569;
  --color-sg-neutral-700: #334155;
  --color-sg-neutral-800: #1e293b;
  --color-sg-neutral-900: #0f172a;

  /* Aksen — tautan, fokus, tindakan utama */
  --color-sg-accent-50:   #eff6ff;
  --color-sg-accent-100:  #dbeafe;
  --color-sg-accent-500:  #3b82f6;
  --color-sg-accent-600:  #2563eb;
  --color-sg-accent-700:  #1d4ed8;

  /* Semantik */
  --color-sg-success-50:  #f0fdf4;
  --color-sg-success-500: #22c55e;
  --color-sg-success-700: #15803d;

  --color-sg-warning-50:  #fffbeb;
  --color-sg-warning-500: #f59e0b;
  --color-sg-warning-700: #b45309;

  --color-sg-danger-50:   #fef2f2;
  --color-sg-danger-500:  #ef4444;
  --color-sg-danger-700:  #b91c1c;

  --color-sg-info-50:     #f0f9ff;
  --color-sg-info-500:    #0ea5e9;
  --color-sg-info-700:    #0369a1;

  /* Ungu — dicadangkan khusus untuk penanda "dibangkitkan sistem" */
  --color-sg-system-50:   #faf5ff;
  --color-sg-system-500:  #a855f7;
  --color-sg-system-700:  #7e22ce;
}
```

### 2.2 Semantik warna lintas modul

Aturan paling penting dalam dokumen ini: **satu makna, satu warna, di seluruh sistem**. Auditor yang berpindah antar-modul tidak boleh perlu belajar ulang arti warna.

| Makna | Warna | Modul A | Modul B | Modul C |
|---|---|---|---|---|
| **Selesai, diterima, disetujui** | Hijau | Bukti Diterima, Permintaan Selesai | Terverifikasi Tertutup, Item Diputuskan | Berlaku, Attestation Selesai |
| **Sedang berjalan, menunggu** | Biru | Dalam Penelaahan, Diserahkan | Berjalan, Menunggu Verifikasi | Dalam Penelaahan, Menunggu Pengesahan |
| **Perlu perhatian, mendekati tenggat** | Kuning | Mendekati tenggat, Info Tambahan | Reviewer belum bergerak, SLA mendekat | Terlambat Ditinjau, Menunggu Persetujuan |
| **Bermasalah, gagal, terlewat** | Merah | Ditolak, Terlewat tenggat | Gagal Diverifikasi, Anomali Kritis | Ditarik saat masih dirujuk |
| **Netral, belum dimulai, arsip** | Abu-abu | Draf, Tidak Berlaku | Belum Diputuskan, Draf | Draf, Digantikan |
| **Dibangkitkan sistem** | Ungu | Paket bukti kampanye | — | Laporan attestation |

**Konsekuensi.** Warna kuning **tidak boleh** dipakai untuk hal netral seperti "informasi tambahan" pada satu modul, karena di modul lain kuning berarti perlu tindakan.

### 2.3 Warna tingkat risiko

Berbeda dari status, tingkat risiko memakai skala tersendiri agar tidak tertukar.

| Tingkat | Latar | Teks | Penanda |
|---|---|---|---|
| Kritis | `--color-sg-danger-50` | `--color-sg-danger-700` | Garis kiri tebal 3px |
| Tinggi | `#fff7ed` | `#c2410c` | Garis kiri tebal 3px |
| Sedang | `--color-sg-warning-50` | `--color-sg-warning-700` | Garis kiri 2px |
| Rendah | `--color-sg-neutral-100` | `--color-sg-neutral-600` | Tanpa garis |

### 2.4 Warna klasifikasi informasi

Klasifikasi selalu ditampilkan sebagai lencana dengan garis tepi, bukan latar penuh, agar tidak bersaing dengan status.

| Klasifikasi | Garis tepi | Teks | Ikon |
|---|---|---|---|
| Publik | `--color-sg-neutral-300` | `--color-sg-neutral-600` | 🌐 |
| Internal | `--color-sg-accent-500` | `--color-sg-accent-700` | 🏢 |
| Terbatas | `--color-sg-warning-500` | `--color-sg-warning-700` | 🔒 |
| Rahasia | `--color-sg-danger-500` | `--color-sg-danger-700` | 🔐 |

### 2.5 Tipografi

```css
:root {
  --sg-font-sans: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
  --sg-font-mono: 'JetBrains Mono', 'Consolas', monospace;

  --sg-text-2xs:  11px;  --sg-leading-2xs:  16px;
  --sg-text-xs:   12px;  --sg-leading-xs:   16px;
  --sg-text-sm:   13px;  --sg-leading-sm:   20px;
  --sg-text-base: 14px;  --sg-leading-base: 21px;
  --sg-text-md:   16px;  --sg-leading-md:   24px;
  --sg-text-lg:   18px;  --sg-leading-lg:   26px;
  --sg-text-xl:   22px;  --sg-leading-xl:   30px;
  --sg-text-2xl:  28px;  --sg-leading-2xl:  36px;

  --sg-weight-normal:   400;
  --sg-weight-medium:   500;
  --sg-weight-semibold: 600;
}
```

**Ukuran dasar 14px, bukan 16px.** Ini keputusan sadar untuk aplikasi padat data. Pengecualian: isi dokumen kebijakan dirender pada 16px dengan tinggi baris 1,7 karena dibaca dalam durasi panjang.

**Penggunaan huruf monospasi.** Wajib untuk sidik jari kriptografis, kode teknis hak akses, nomor tiket, dan kode dokumen. Nilai-nilai ini sering dibandingkan karakter per karakter.

**Skala penggunaan.**

| Elemen | Ukuran | Bobot |
|---|---|---|
| Judul halaman | `xl` | semibold |
| Judul bagian | `lg` | semibold |
| Judul kartu | `md` | semibold |
| Teks isi | `base` | normal |
| Teks tabel | `sm` | normal |
| Kepala kolom tabel | `xs` | semibold, huruf kapital, jarak huruf 0,04em |
| Metadata & keterangan | `xs` | normal |
| Lencana | `2xs` | semibold |

### 2.6 Jarak

Kelipatan 4 piksel.

```css
:root {
  --sg-space-1: 4px;   --sg-space-2: 8px;   --sg-space-3: 12px;
  --sg-space-4: 16px;  --sg-space-5: 20px;  --sg-space-6: 24px;
  --sg-space-8: 32px;  --sg-space-10: 40px; --sg-space-12: 48px;
}
```

| Konteks | Jarak |
|---|---|
| Isian sel tabel | `--sg-space-3` mendatar, `--sg-space-2` tegak (mode padat) |
| Isian sel tabel (mode nyaman) | `--sg-space-4` mendatar, `--sg-space-3` tegak |
| Isian kartu | `--sg-space-4` |
| Jarak antar-bagian | `--sg-space-6` |
| Jarak antar-elemen formulir | `--sg-space-4` |
| Isian halaman | `--sg-space-6` |

### 2.7 Radius & elevasi

```css
:root {
  --sg-radius-sm: 4px;   /* lencana, kolom masukan */
  --sg-radius-md: 6px;   /* tombol, kartu */
  --sg-radius-lg: 8px;   /* dialog, panel */

  --sg-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --sg-shadow-md: 0 2px 8px rgba(15, 23, 42, 0.08);
  --sg-shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12);
}
```

Elevasi hanya dipakai untuk elemen yang benar-benar melayang: menu tarik-turun, dialog, dan bilah aksi lengket. Kartu memakai garis tepi, bukan bayangan.

### 2.8 Mode gelap

Tersedia sebagai pilihan pengguna, bukan bawaan. Netral dibalik; warna semantik disesuaikan agar tetap memenuhi kontras minimum.

```css
[data-theme="dark"] {
  --color-sg-neutral-0:   #0f172a;
  --color-sg-neutral-50:  #1e293b;
  --color-sg-neutral-100: #334155;
  --color-sg-neutral-900: #f8fafc;

  --color-sg-success-500: #4ade80;
  --color-sg-warning-500: #fbbf24;
  --color-sg-danger-500:  #f87171;
  --color-sg-accent-500:  #60a5fa;
}
```

**Pengecualian.** Isi dokumen kebijakan dan pratinjau bukti tetap dirender dengan latar terang, karena keduanya adalah reproduksi dokumen resmi dan pembalikan warna dapat mengubah tampilan tabel serta stempel di dalamnya.

---

## 3. Inventaris Komponen

### 3.1 Tabel data

Komponen paling penting dalam sistem. Dipakai pada 11 dari 16 layar.

**Kemampuan wajib.**

| Kemampuan | Ketentuan |
|---|---|
| Kolom konfigurabel | Pengguna dapat menyembunyikan, menampilkan, dan mengubah urutan kolom; preferensi tersimpan per pengguna per tabel |
| Kepala kolom lengket | Tetap terlihat saat menggulir |
| Kolom identitas lengket | Kolom pertama (nama orang atau nomor) tetap terlihat saat menggulir mendatar |
| Pengurutan | Klik kepala kolom; indikator arah jelas; dukungan pengurutan bertingkat |
| Pemilihan baris | Kotak centang dengan pilih-semua yang menyatakan cakupannya: "semua yang terlihat" atau "seluruh 4.127 hasil" |
| Bilah aksi lengket | Muncul di bawah saat ada baris terpilih, memuat jumlah terpilih dan aksi yang tersedia |
| Kepadatan | Sakelar padat/nyaman; bawaan padat |
| Pemuatan bertahap | Untuk tabel di atas 200 baris |
| Ekspor | Menghormati penyaring yang sedang aktif |

**Aturan tampilan.**

1. **Baris tidak boleh berwarna latar penuh** untuk menandai status. Warna latar penuh membuat teks sulit dibaca dan menghilangkan efek garis-garis zebra. Gunakan garis kiri tebal 3px.
2. **Angka rata kanan**, teks rata kiri, tanggal rata kiri.
3. **Kolom aksi selalu paling kanan** dan tidak ikut menggulir.
4. Sel kosong menampilkan tanda hubung `—`, bukan dibiarkan kosong sepenuhnya, agar terlihat bahwa datanya memang tidak ada.
5. Sel yang datanya tidak tersedia dari sumber menampilkan `tidak tersedia` dalam warna redup — berbeda dari `—` yang berarti kosong. Perbedaan ini menegakkan FR-X-020.

### 3.2 Lencana status

```
┌──────────────┐
│ ● BERJALAN   │   Titik + label huruf kapital, ukuran 2xs
└──────────────┘
```

| Ketentuan | Nilai |
|---|---|
| Bentuk | Persegi panjang, radius `sm` |
| Isian | 2px tegak, 8px mendatar |
| Latar | Warna semantik tingkat 50 |
| Teks | Warna semantik tingkat 700 |
| Titik | Warna semantik tingkat 500, diameter 6px |
| Huruf | Kapital, jarak huruf 0,04em |

Lencana **tidak pernah** dipakai untuk hal yang bukan status. Tingkat risiko, klasifikasi, dan penanda lain memiliki komponen tersendiri agar tidak tertukar.

### 3.3 Kendali keputusan

Komponen khusus untuk layar review dan persetujuan. Dirancang untuk menegakkan U4.

```
Keputusan Anda:
 ( ) Pertahankan    ( ) Cabut    ( ) Ubah    ( ) Alihkan
```

**Ketentuan mengikat.**

1. **Tidak ada pilihan terpilih saat ditampilkan.** Tidak ada nilai bawaan dalam keadaan apa pun.
2. Pilihan disusun mendatar bila muat, tegak bila tidak. Urutan selalu sama di seluruh sistem.
3. Pilihan yang berdampak destruktif tidak diberi warna merah pada keadaan belum terpilih — mewarnainya lebih awal menekan pengguna secara tidak semestinya. Warna muncul setelah terpilih.
4. Kolom alasan muncul tepat di bawah setelah keputusan dipilih, dengan label yang menjelaskan mengapa ia wajib.
5. Tombol simpan nonaktif sampai syarat terpenuhi, dengan teks pendamping yang menyatakan apa yang kurang.

### 3.4 Kartu item review

Digunakan untuk item yang menuntut perhatian penuh.

**Anatomi.**

```
┌─ Pita peringatan (bila ada) ────────────────────────┐
│ ⚠ KONFLIK PEMISAHAN TUGAS                           │
├─────────────────────────────────────────────────────┤
│ Identitas: nama · nomor · jabatan · unit            │
│                                                      │
│ ┌─ Blok hak akses ──────────────────────────────┐   │
│ │ 🔑 Nama tampilan            [LENCANA ISTIMEWA]│   │
│ │ Penjelasan dalam bahasa non-teknis            │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ Konteks: diberikan · terakhir diakses · keputusan   │
│          sebelumnya                                  │
│                                                      │
│ Peringatan konflik dalam kalimat bisnis             │
│                                                      │
│ Kendali keputusan                                    │
│ Kolom alasan                                         │
│                              [Simpan & Lanjut →]     │
└─────────────────────────────────────────────────────┘
```

**Ketentuan.** Penjelasan hak akses dalam bahasa non-teknis ditampilkan sebagai teks utama, bukan keterangan kecil. Bagi manajer lini, inilah satu-satunya informasi yang benar-benar dapat ia nilai.

### 3.5 Kartu rujukan (sitasi)

Dipakai pada panel jawaban Modul C.

```
┌──────────────────────────────────────────────────────┐
│ 📄 SOP-OPS-014 · SOP Penyelesaian Transaksi Efek v3.1│
│    Bab IV Pasal 12 ayat (2)      Berlaku 1 Apr 2026 │
└──────────────────────────────────────────────────────┘
```

**Ketentuan.**

1. Nomor bagian ditampilkan dengan bobot medium, bukan sebagai keterangan redup. Inilah bagian yang diverifikasi pengguna.
2. Seluruh kartu dapat diklik, membuka dokumen tepat pada bagian tersebut dengan penyorotan.
3. Tanggal berlaku ditampilkan agar pengguna dapat menilai kemutakhiran rujukan.
4. Kartu memiliki keadaan tekan yang jelas, karena kartu yang tidak terlihat dapat diklik jarang diklik.

### 3.6 Garis waktu jejak audit

Dipakai pada riwayat objek dan rantai kepemilikan bukti.

```
│
├─● 27 Agu 2026, 09:14   Sari Wulandari
│  Versi 2 diunggah
│  Sidik jari: e3b0c442…b855
│
├─○ 21 Agu 2026, 08:30   Bayu Pratama
│  Ditolak — data hak akses tidak lengkap
│
├─○ 20 Agu 2026, 14:02   Sari Wulandari
│  Diunggah
```

**Ketentuan.**

1. Urutan menurun, terbaru di atas.
2. Titik terisi untuk keadaan sekarang, kosong untuk riwayat.
3. Nilai kriptografis dipotong di tengah dengan elipsis dan dapat disalin utuh.
4. Aksi ditulis dalam kalimat lengkap berbahasa Indonesia, bukan kode aksi seperti `EVIDENCE_SUBMIT`.

### 3.7 Pengunggah berkas

**Keadaan.**

| Keadaan | Tampilan |
|---|---|
| Kosong | Area seret-dan-lepas dengan garis putus-putus, keterangan jenis dan ukuran yang diizinkan |
| Menyeret | Garis tepi aksen, latar aksen tingkat 50 |
| Mengunggah | Batang kemajuan per berkas dengan persentase dan tombol batal |
| Memindai | Ikon berputar dengan keterangan "Sedang dipindai" dan penjelasan bahwa pengguna dapat melanjutkan pekerjaan lain |
| Bersih | Ikon centang hijau, nama berkas, ukuran, sidik jari terpotong |
| Terinfeksi | Latar merah, keterangan berkas dikarantina dan telah dilaporkan |
| Ditolak jenis | Merah dengan daftar jenis yang diizinkan |
| Terlalu besar | Merah dengan ukuran berkas dan batas maksimum |

**Ketentuan.** Keadaan "memindai" tidak boleh memblokir antarmuka. Pengguna dapat menutup halaman dan menerima notifikasi.

### 3.8 Panel penyaring

Ditempatkan di kolom kiri untuk daftar panjang, atau sebagai baris tombol untuk daftar pendek.

**Ketentuan.**

1. Setiap pilihan menampilkan jumlah hasil yang akan diperoleh.
2. Penyaring aktif ditampilkan sebagai keping yang dapat dihapus di atas hasil.
3. Tombol "Hapus semua penyaring" muncul bila ada lebih dari satu penyaring aktif.
4. Penyaring tercermin pada alamat halaman.
5. Untuk pencarian dokumen, jumlah dihitung setelah penyaringan hak akses — ketentuan keamanan, bukan sekadar tampilan.

### 3.9 Pembanding versi dokumen

Tampilan dua kolom berdampingan dengan penyorotan perbedaan.

| Jenis perubahan | Penanda |
|---|---|
| Ditambahkan | Latar hijau muda, garis kiri hijau |
| Dihapus | Latar merah muda, teks dicoret |
| Diubah | Latar kuning muda pada bagian yang berubah saja |

**Ketentuan.** Tersedia navigasi "perubahan berikutnya" karena dokumen panjang dengan sedikit perubahan sulit ditelusuri secara manual.

### 3.10 Batang kemajuan

Dipakai untuk kesiapan penugasan, kemajuan kampanye, dan penyelesaian attestation.

**Ketentuan.**

1. **Selalu disertai angka absolut**, bukan hanya persentase. "68,3% · 28 dari 41" bukan "68,3%".
2. Warna mengikuti kondisi terhadap tenggat, bukan terhadap nilai persentase. Kampanye 60% selesai dengan tenggat tersisa 10 hari berwarna hijau; kampanye 90% selesai dengan tenggat besok berwarna kuning.
3. Segmen berwarna berbeda dipakai bila komposisinya bermakna, misalnya jumlah keputusan per jenis.

### 3.11 Keadaan kosong

**Anatomi.** Judul singkat, satu kalimat penjelasan, satu tombol tindakan utama. Tanpa ilustrasi.

| Konteks | Judul | Penjelasan |
|---|---|---|
| Belum ada penugasan | Belum ada penugasan | Penugasan audit dan assessment yang Anda buat akan muncul di sini. |
| Tidak ada tugas | Tidak ada tugas untuk Anda | Semua kewajiban Anda sudah selesai. |
| Hasil penyaringan kosong | Tidak ada hasil dengan penyaring ini | Coba hapus sebagian penyaring atau ubah kata kunci. |
| Pencarian nihil | Tidak ditemukan dokumen | *(disertai saran istilah dan tawaran bertanya ke unit pemilik)* |

### 3.12 Dialog konfirmasi

Dipakai untuk aksi yang sulit dibatalkan.

**Ketentuan.**

1. Judul menyatakan aksi, bukan pertanyaan umum. "Batalkan kampanye ini?" bukan "Anda yakin?"
2. Isi menyatakan **konsekuensi dengan angka nyata**: "3.102 keputusan yang sudah diambil akan diarsipkan dan 38 reviewer akan diberi tahu."
3. Tombol konfirmasi memakai kata kerja yang sama dengan aksinya: "Batalkan Kampanye", bukan "OK".
4. Tombol destruktif berwarna merah dan **tidak** menjadi fokus bawaan.
5. Aksi yang sangat berdampak menuntut pengguna mengetik nama objek untuk mengonfirmasi.

---

## 4. Pola Tata Letak

### 4.1 Kerangka halaman

```
┌──────────────────────────────────────────────────────────────┐
│ Bilah atas — 56px                                            │
├──────────┬───────────────────────────────────────────────────┤
│ Bilah    │ Remah roti                                        │
│ sisi     │ Judul halaman + aksi utama                        │
│ 240px    │ ─────────────────────────────────────────────     │
│          │ Isi                                                │
│ (dapat   │                                                    │
│ diciut-  │                                                    │
│ kan ke   │                                                    │
│ 64px)    │                                                    │
└──────────┴───────────────────────────────────────────────────┘
```

Lebar isi maksimum 1.600px dengan pemusatan pada layar yang lebih lebar, kecuali tabel padat yang memakai lebar penuh.

### 4.2 Tata letak halaman rincian

Dua kolom: isi utama di kiri (rasio 2 bagian), metadata dan aksi di kanan (1 bagian). Kolom kanan lengket saat menggulir. Pada layar di bawah 1024px, kolom kanan pindah ke atas isi utama dalam bentuk ringkas.

### 4.3 Tata letak formulir

Label di atas kolom masukan, bukan di sampingnya — memberi lebih banyak ruang untuk teks label berbahasa Indonesia yang cenderung panjang.

| Elemen | Ketentuan |
|---|---|
| Kolom wajib | Ditandai `*` merah setelah label, dengan keterangan "wajib" pada teks pendamping bila alasannya perlu dijelaskan |
| Teks bantuan | Di bawah label, sebelum kolom masukan |
| Kesalahan | Di bawah kolom, warna merah, dengan garis tepi kolom berubah merah |
| Pengelompokan | Bagian dengan judul untuk formulir lebih dari 8 kolom |
| Tombol | Rata kanan di bawah; tindakan utama paling kanan |

---

## 5. Ikonografi

Menggunakan Lucide Icons dengan ketebalan garis 1,5px dan ukuran 16px pada teks, 20px pada tombol.

**Ikon yang maknanya dikunci.**

| Ikon | Makna | Tidak boleh dipakai untuk |
|---|---|---|
| 📄 Dokumen | Dokumen kebijakan/SOP | Berkas bukti |
| 📎 Klip | Berkas bukti | Dokumen kebijakan |
| 🔑 Kunci | Hak akses | Keamanan umum |
| 🔒 Gembok tertutup | Klasifikasi Terbatas | Objek terkunci karena sudah ditandatangani |
| 🛡 Perisai | Objek terkunci/tidak dapat diubah | Keamanan umum |
| ⚠ Segitiga | Peringatan yang perlu tindakan | Informasi netral |
| ℹ Lingkaran-i | Informasi netral | Peringatan |
| ♻ Daur ulang | Bukti dipakai ulang | — |
| ⚙ Roda gigi | Dibangkitkan sistem | Pengaturan |

**Ketentuan.** Ikon selalu disertai label teks, kecuali pada tombol aksi tabel yang berulang, dan di sana wajib memiliki tooltip serta label untuk pembaca layar.

---

## 6. Gerakan

| Jenis | Durasi | Kurva |
|---|---|---|
| Mikro — hover, fokus | 120ms | `ease-out` |
| Kecil — tarik-turun, tooltip | 160ms | `ease-out` |
| Sedang — panel, laci | 220ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Dialog | 200ms | `ease-out` |

**Ketentuan.**

1. Tidak ada animasi masuk pada baris tabel. Tabel 200 baris yang beranimasi terasa lambat dan mengganggu.
2. Baris yang dihapus setelah keputusan diambil memudar dalam 160ms — ini menjelaskan sebab-akibat.
3. Batang kemajuan bergerak halus untuk perubahan kecil, langsung untuk perubahan besar.
4. Preferensi pengurangan gerakan sistem dihormati: seluruh transisi menjadi 0ms.

---

## 7. Bahasa & Microcopy

### 7.1 Nada

Formal, ringkas, dan tidak menghakimi. Bahasa Indonesia baku tanpa terkesan kaku birokratis.

| Prinsip | Contoh benar | Contoh salah |
|---|---|---|
| Menyatakan fakta, bukan menyalahkan | "Tenggat telah lewat 2 hari." | "Anda terlambat menyerahkan bukti." |
| Menjelaskan langkah berikutnya | "Bukti perlu diperbaiki. Auditor meminta daftar hak akses per pengguna disertakan." | "Bukti ditolak." |
| Menyebut akibat pada peringatan | "Hak akses yang hilang dari berkas tidak akan ditinjau pada kampanye ini." | "Jumlah baris berkurang 34%." |
| Aktif, bukan pasif berbelit | "Sistem akan memverifikasi pencabutan pada snapshot berikutnya." | "Verifikasi pencabutan akan dilakukan oleh sistem." |
| Tanpa istilah teknis untuk pengguna sesekali | "Daftar pengguna dan hak aksesnya" | "Entitlement snapshot" |

### 7.2 Istilah baku

Satu konsep, satu istilah, di seluruh sistem.

| Konsep | Istilah yang dipakai | Tidak dipakai |
|---|---|---|
| Berkas pendukung audit | **bukti** | dokumen pendukung, lampiran, evidence |
| Orang yang meninjau akses | **reviewer** | peninjau, penilai, approver |
| Orang yang bertanggung jawab atas aplikasi | **pemilik aplikasi** | app owner, penanggung jawab aplikasi |
| Hak akses dalam aplikasi | **hak akses** | entitlement, role, privilege |
| Siklus review akses | **kampanye** | siklus, batch, periode review |
| Pengambilan data akses | **snapshot** | tarikan data, ekstraksi, dump |
| Kegiatan audit | **penugasan** | engagement, proyek audit, assignment |
| Daftar permintaan bukti | **permintaan bukti** | PBC, request list |
| Menyatakan telah membaca | **pernyataan telah membaca** | attestation, acknowledgment |
| Aturan pemisahan tugas | **pemisahan tugas** | SoD, segregation of duties |

**Istilah teknis yang dipertahankan dalam bahasa Inggris** karena tidak memiliki padanan yang lazim dan dipahami penggunanya: `sign-off`, `snapshot` (dalam konteks teknis Modul B), dan `hash`/sidik jari (keduanya dipakai, "sidik jari" untuk pengguna umum, `hash` pada dokumentasi teknis).

### 7.3 Format angka & tanggal

| Jenis | Format | Contoh |
|---|---|---|
| Tanggal ringkas | `d MMM yyyy` | 27 Agu 2026 |
| Tanggal lengkap | `d MMMM yyyy` | 27 Agustus 2026 |
| Tanggal + waktu | `d MMM yyyy, HH:mm` | 27 Agu 2026, 09:14 |
| Waktu relatif | Sampai 7 hari | 2 jam lalu, kemarin, 3 hari lalu |
| Rentang tanggal | `d MMM – d MMM yyyy` | 1 Jan – 30 Jun 2026 |
| Angka | Titik sebagai pemisah ribuan | 4.127 |
| Desimal | Koma sebagai pemisah desimal | 68,3% |
| Uang | `Rp` + pemisah ribuan | Rp 1.500.000 |
| Zona waktu | Dicantumkan bila bermakna | 16.00 WIB |

Zona waktu **wajib** dicantumkan pada catatan sign-off, jejak audit, dan laporan yang diserahkan kepada auditor.

### 7.4 Penanganan nama panjang

Nama Indonesia dapat sangat panjang dan tidak boleh dipotong sembarangan.

| Konteks | Perlakuan |
|---|---|
| Tabel | Potong dengan elipsis, tampilkan penuh pada tooltip |
| Kartu | Bungkus ke baris berikutnya, maksimum dua baris |
| Lencana | Tidak pernah memuat nama orang |
| Laporan cetak | Selalu penuh, tidak pernah dipotong |
| Tanda air | Nama penuh + nomor induk |

### 7.5 Kalimat baku untuk keadaan penting

| Situasi | Kalimat |
|---|---|
| Jawaban ditolak klasifikasi | "Dokumen yang relevan berklasifikasi terbatas, sehingga tidak diproses oleh layanan jawaban otomatis. Anda tetap dapat membuka dokumennya langsung." |
| Dasar tidak memadai | "Tidak ditemukan dasar yang memadai dalam dokumen internal untuk menjawab pertanyaan ini." |
| Penafian jawaban | "Dokumen sumber merupakan acuan yang mengikat." |
| Dokumen kedaluwarsa | "Versi ini tidak lagi berlaku sejak 1 April 2026. Lihat versi terkini." |
| Tiket menunggu verifikasi | "Tiket akan tertutup otomatis setelah pengambilan data berikutnya membuktikan hak akses telah tidak ada." |
| Verifikasi gagal | "Hak akses masih ditemukan pada data tanggal 13 September 2026. Tiket dibuka kembali." |
| Alasan wajib pada akses istimewa | "Alasan wajib diisi karena hak akses ini bertanda istimewa." |
| Sebelum sign-off | "Setelah ditandatangani, keputusan tidak dapat diubah tanpa persetujuan IT Security." |
| Item dikecualikan dari aksi massal | "Hak akses istimewa harus diputuskan satu per satu." |

---

## 8. Tanda Air & Pencetakan

### 8.1 Tanda air pratinjau

Wajib pada pratinjau dokumen dan bukti berklasifikasi Terbatas ke atas, serta seluruh akses auditor eksternal.

| Ketentuan | Nilai |
|---|---|
| Isi | Nama pengguna · nomor induk · waktu akses · pengenal permintaan |
| Posisi | Diagonal berulang menutupi seluruh halaman |
| Warna | Abu-abu 12% keburaman |
| Ukuran | Cukup terbaca pada tangkapan layar, tidak menghalangi isi |

### 8.2 Pencetakan & PDF laporan

| Elemen | Ketentuan |
|---|---|
| Kepala halaman | Logo, nama laporan, parameter yang dipakai |
| Kaki halaman | Nomor halaman "n dari m", waktu pembuatan dengan zona waktu, nama pembuat, klasifikasi |
| Warna | Tetap dicetak; status yang hanya dibedakan warna wajib disertai label teks |
| Tabel | Kepala kolom diulang pada setiap halaman |
| Paket bukti | Halaman muka berisi ringkasan cakupan dan sidik jari isi |

---

## 9. Implementasi Frontend

### 9.1 Struktur komponen

```
src/
├── components/
│   ├── primitives/        # Tombol, Masukan, Lencana, Dialog — pembungkus Radix
│   ├── data/              # TabelData, PanelPenyaring, BatangKemajuan
│   ├── domain/            # KartuItemReview, KartuRujukan, GarisWaktuAudit,
│   │                      # PengunggahBerkas, KendaliKeputusan
│   └── layout/            # KerangkaHalaman, BilahSisi, RemahRoti
├── features/
│   ├── policy/            # Modul C
│   ├── audit/             # Modul A
│   └── access/            # Modul B
└── lib/
    ├── format/            # Format tanggal, angka, nama Indonesia
    ├── permissions/       # Pemeriksaan hak akses sisi klien untuk tampilan
    └── api/               # Klien API bertipe
```

### 9.2 Ketentuan yang mengikat pengembang

1. **Pemeriksaan hak akses di sisi klien hanya untuk tampilan.** Setiap operasi tetap diperiksa di peladen. Menyembunyikan tombol bukan kontrol keamanan.
2. **Komponen `KendaliKeputusan` tidak menerima properti nilai bawaan.** Ketiadaan properti ini adalah penegakan U4 pada tingkat kode.
3. **Warna semantik hanya diakses melalui token**, tidak pernah nilai heksadesimal langsung. Ini menjaga konsistensi makna lintas modul.
4. **Setiap tabel wajib menangani lima keadaan**: memuat, kosong, kosong karena penyaring, kesalahan, dan berisi data.
5. **Format tanggal dan angka hanya melalui fungsi di `lib/format`.** Pemformatan langsung menghasilkan ketidakkonsistenan.
6. **Teks antarmuka berada pada berkas terpisah**, bukan tertanam dalam komponen, agar dapat ditinjau Divisi Kepatuhan tanpa membaca kode.

### 9.3 Kinerja

| Ketentuan | Nilai |
|---|---|
| Ukuran berkas JavaScript awal | Di bawah 200 KB terkompresi |
| Pemuatan bertahap per rute | Wajib; modul yang tidak dibuka tidak diunduh |
| Virtualisasi tabel | Wajib di atas 200 baris |
| Penundaan pencarian saat mengetik | 300ms |
| Pratinjau PDF | Dimuat sesuai permintaan, tidak otomatis |

---

## 10. Daftar Periksa Kesiapan Rancangan

Setiap layar sebelum dinyatakan selesai:

- [ ] Lima keadaan tabel/daftar ditangani
- [ ] Dapat dioperasikan penuh dengan papan ketik, urutan fokus mengikuti urutan visual
- [ ] Kontras memenuhi 4,5:1 untuk teks
- [ ] Tidak ada informasi yang hanya disampaikan melalui warna
- [ ] Nama panjang dan angka besar tidak merusak tata letak
- [ ] Pesan kesalahan menjelaskan langkah berikutnya
- [ ] Aksi destruktif memiliki konfirmasi yang menyebut konsekuensi nyata
- [ ] Istilah sesuai daftar baku §7.2
- [ ] Format tanggal dan angka sesuai §7.3
- [ ] Berfungsi pada pembesaran 200%
- [ ] Mode gelap diperiksa untuk kontras
- [ ] Klasifikasi dan tanda air diterapkan bila diperlukan
- [ ] Tidak ada pilihan bawaan pada keputusan berdampak

---

*Dokumen terkait: [05-UIUX-FLOW.md](05-UIUX-FLOW.md) · [03-FRD.md](03-FRD.md)*
