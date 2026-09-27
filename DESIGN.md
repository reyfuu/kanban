---
name: HoyoKanban
description: Ruang sederhana untuk merencanakan build karakter.
colors:
  background: "#101414"
  surface: "#191e1d"
  sidebar: "#141918"
  foreground: "#edf2ed"
  muted: "#a4afa8"
  accent: "#b9d99b"
  border: "#303a33"
---

# Design System: HoyoKanban

## Overview

**Creative North Star: "Satu build, satu langkah."**

Pemain membuka HoyoKanban untuk memilih karakter yang ingin dikerjakan berikutnya. Papan karakter menjadi fokus; angka stamina, kalkulator, dan pengaturan tidak lagi bersaing pada layar pertama. Tema gelap dipertahankan dari aplikasi yang ada, dengan aksen hijau lembut dan ruang kosong lebih luas.

Dokumen ini ditulis sebelum perubahan UI sesuai permintaan pengguna. Panduan yang digunakan: [Impeccable](https://github.com/pbakaus/impeccable), khususnya distill, operate, dan craft-floor. Implementasi mempertahankan kemampuan aplikasi serta data lokal yang sudah ada.

## Keputusan UX

| Pendekatan | Dampak | Keputusan |
|---|---|---|
| Sidebar dan halaman terpisah | Setiap layar punya satu pekerjaan; URL bisa dibuka langsung | Dipakai |
| Dashboard dengan banyak accordion | Perubahan kecil, tetapi masih mengumpulkan semua tugas di satu halaman | Tidak dipakai |
| Wizard langkah demi langkah | Fokus kuat, tetapi terlalu lambat untuk pengguna yang kembali setiap hari | Tidak dipakai |

Sidebar: **Papan karakter**, **Rutinitas**, **Jadwal farming**, **Gacha planner**, kemudian **Pengaturan** dan akses **Masuk** di bagian bawah. Tidak ada badge versi hosting, statistik dekoratif, atau tombol backup di header utama.

## Colors

Latar arang kehijauan, teks netral terang, satu aksen sage. Warna game hanya menjadi penanda kecil, bukan pewarna seluruh panel.

- Background `#101414`: kanvas aplikasi.
- Sidebar `#141918`: navigasi permanen desktop.
- Surface `#191e1d`: kartu karakter dan dialog.
- Foreground `#edf2ed`: judul dan konten utama.
- Muted `#a4afa8`: keterangan dan label sekunder, tetap terbaca.
- Accent `#b9d99b`: aksi utama, fokus, seleksi.
- Border `#303a33`: batas bidang input dan pemisah.
- Danger `#f2a9a1`: pesan gagal dan hapus; success memakai accent.

## Typography

Satu font sistem sans-serif, tersedia tanpa unduhan font saat build. Body 14–16 px, label 13–14 px, judul halaman 28 px, judul login 36 px. Maksimal tiga bobot: 400, 500, 650. Angka memakai tabular numerals. Tidak menggunakan gradient text atau teks 9–10 px untuk informasi penting. Permintaan eksplisit pengguna: tidak ada emoji di UI; ikon memakai SVG.

## Spacing and Layout

Skala 4, 8, 12, 16, 24, 32, 48 px. Sidebar 232 px pada desktop. Konten diberi padding 32 px, maksimum lebar 1440 px. Tiga kolom papan dengan jarak 20 px. Mobile memakai header ringkas, tombol menu, dan drawer native; papan menjadi satu kolom bertumpuk tanpa horizontal overflow halaman.

## Components

### Papan karakter (`/`)

- Judul, satu kalimat konteks, dan satu CTA **Tambah karakter**.
- Toolbar: pencarian nama dan filter game; jumlah hasil sebagai teks kecil.
- Tiga kelompok visual: **Rencana**, **Dalam proses**, **Selesai**.
- Tujuh tahap data tetap dipertahankan. Wishlist/Backlog masuk Rencana; Leveling/Talents/Gear/Tuning masuk Dalam proses; Ready masuk Selesai. Tahap rinci ditampilkan kecil dan dapat diubah di detail.
- Drag antar kelompok berpindah ke tahap awal kelompok; tombol pindah tahap tetap tersedia untuk keyboard dan layar sentuh.
- Kartu hanya menampilkan avatar, nama, game/elemen, level saat ini/target, prioritas, dan tahap. Gear, tag panjang, talenta, defisit, serta catatan ada di detail.
- Pengguna baru mendapat papan kosong dengan CTA jelas; data contoh hanya dimuat atas permintaan. Kartu lama tidak dihapus atau dikurangi.

### Rutinitas (`/routine`)

Resin, battery, dan checklist dipindah ke halaman tersendiri. Timer merupakan estimasi dari input pengguna, bukan klaim sinkronisasi HoYoLAB. Semua aksi stamina yang sudah ada tetap tersedia.

### Farming (`/farming`) dan gacha (`/gacha`)

Jadwal berbentuk daftar per kelompok, bukan bertingkat dalam banyak kartu. Pemilih hari untuk melihat jadwal lain. Gacha berupa form sederhana; hasil konversi berada setelah input. Perhitungan tetap lokal.

### Pengaturan (`/settings`)

Ekspor/impor JSON dan informasi sumber data berada di sini. Impor diperiksa sebelum data diganti; backup yang tidak valid tidak boleh menimpa data pengguna.

### Masuk (`/login`)

Satu panel sambutan dan satu bidang masuk yang jelas. Tidak meniru halaman resmi HoYoverse. Akun aplikasi dan UID game adalah dua hal berbeda. Mode tamu tetap dapat membuka papan lokal.

Pertanyaan provider login telah dikirim. Jika belum dijawab, halaman masuk dan mode tamu diselesaikan dahulu; tidak membuat autentikasi palsu dengan localStorage atau mengklaim cloud sync. Tombol login provider hanya aktif jika autentikasi benar-benar dikonfigurasi. Tidak meminta kata sandi atau cookie HoYoverse.

### Dialog

Gunakan `<dialog>` untuk modal, Escape, fokus terkurung, dan pengembalian fokus. Form tambah: cari, pilih, tempatkan; pilihan lainnya disembunyikan di pengaturan opsional. Detail: target, material, catatan. State form baru mengikuti kartu yang dibuka, tanpa hook kondisional.

## States and Accessibility

- Loading memakai placeholder sederhana; tidak ada animasi pulse dekoratif.
- Empty state menjelaskan aksi berikutnya.
- Error memakai pesan spesifik dan pemulihan yang dapat dilakukan.
- Tombol punya hover, focus-visible, disabled; target sentuh minimal 44 px.
- Semua input punya label. Ikon berupa SVG dengan bentuk dan ketebalan konsisten.
- Fokus kontras, skip link, landmark nav/main, aria-current pada navigasi.
- Animasi hanya perubahan state 160 ms; hormati prefers-reduced-motion.

## Data dan Vercel

Next.js App Router, Node 24, pnpm workspace tetap digunakan. Data lokal tetap menggunakan key lama agar kompatibel. Tidak ada database wajib untuk mode tamu. API yang dibutuhkan selanjutnya dapat memakai Route Handler, tanpa mewajibkan server Go persisten.

Riset API dipisahkan dalam `docs/HOYO-API.md`: katalog umum, showcase publik, dan data akun pribadi punya cakupan berbeda. Tidak menjanjikan satu UID dapat mengambil seluruh akun.

## Urutan Implementasi dan Verifikasi

1. Tulis desain dan temuan sumber API.
2. Terapkan shell sidebar, halaman terpisah, papan tiga kelompok, kartu ringkas, serta login/tamu.
3. Pertahankan edit, pindah, tambah, hapus, stamina, gacha, ekspor/impor; perbaiki hook dialog dan validasi impor di alur yang disentuh.
4. Jalankan test perilaku data, typecheck, build produksi, lalu satu putaran pemeriksaan desktop/mobile dan satu putaran konfirmasi bila perlu.

Kriteria selesai: layar pertama hanya papan dan kontrol relevan; semua kemampuan lama tetap dapat ditemukan melalui sidebar; login tidak mengaku berhasil tanpa sesi nyata; data lama masih terbaca; build Vercel tetap lulus.

## Pembaruan: katalog nyata dan beberapa papan

- Ambil katalog lengkap yang tersedia dari genshin-db (Genshin) dan Nanoka (ZZZ), dengan Enka sebagai pencocokan roster ZZZ. Simpan snapshot tervalidasi agar Vercel tidak bergantung pada scraping saat request/build. Tampilkan tanggal dan batas cakupan sumber.
- Hapus tawaran papan demo. Jangan menghapus progres lokal lama secara diam-diam.
- Tambah pemilih papan dan form nama papan; kartu baru masuk papan aktif. Kartu lama masuk Papan utama. Backup menyertakan papan.
- Farming: hari mengikuti reset server yang dipilih; filter game, pencarian karakter/material, dan pilihan karakter pada papan aktif atau seluruh katalog. Grup material menampilkan ikon asli, lokasi, jadwal, serta karakter pengguna material. Detail tambahan lewat disclosure agar halaman tetap ringan.
- Login tanpa Google; akses tamu tetap tersedia.
