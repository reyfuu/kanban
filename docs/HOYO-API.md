# Sumber data HoyoKanban

## Integrasi yang sudah berjalan

Snapshot dibuat oleh `pnpm sync:catalog` (Python 3, stdlib). Skrip mengambil JSON publik, memvalidasi roster dan relasi material, mengunduh ikon asli, lalu mengganti `apps/web/src/data/catalog.json` setelah semua unduhan berhasil. Cache unduhan berlaku 24 jam. Kegagalan jaringan tidak mengganti JSON terakhir yang valid.

- **Genshin:** 124 karakter dari [genshin-db](https://github.com/theBowja/genshin-db), beserta biaya ascension/talenta, domain, dan relasi material senjata. API publik: [genshin-db-api](https://github.com/theBowja/genshin-db-api).
- **ZZZ:** 60 agen hasil pencocokan roster [Nanoka](https://zzz.nanoka.cc/) dengan [Enka](https://github.com/EnkaNetwork/API-docs/tree/master/store/zzz). Relasi chip, promotion seal, Expert Challenge, dan Notorious Hunt dibaca dari biaya tiap agen, bukan perkiraan berdasarkan elemen saja.
- **Ikon:** aset Genshin dari Enka dan [Yatta](https://gi.yatta.moe/); aset ZZZ dari Enka dan CDN Nanoka. Byte asli disimpan di `public/catalog`; Next.js mengoptimalkan ukuran kiriman gambar. Hak aset game tetap milik pemiliknya.
- **254 target farming:** talenta/chip, local specialty, promosi agen, boss, boss mingguan, dan material senjata. Angka ini adalah kelompok material farming yang digunakan UI, bukan jumlah seluruh item game.
- **Snapshot ZZZ:** 3.3.3+19166057. Sumber komunitas dapat memiliki data preview atau tertinggal dari game; kecocokan Enka bukan jaminan resmi status rilis. Tanggal snapshot ditampilkan di halaman farming.

Seluruh karakter yang tersedia dalam cakupan sumber tersebut dapat dipilih. Ini tidak berarti semua data HoYoverse atau inventori akun telah diambil. Lore, quest, serta item yang tidak digunakan tracker tidak dimasukkan ke payload browser. API sumber mengembalikan 921 material Genshin dan 5.969 item ZZZ saat pengambilan ini; UI hanya menyimpan relasi yang diperlukan.

## Jadwal dan data pemain

Rotasi Genshin berasal dari `daysOfWeek` material. ZZZ tersedia setiap hari, bukan jadwal acak. Pemilihan hari ini mengikuti reset pukul 04.00 di zona server yang dipilih. Local specialty tetap memiliki respawn, dan reward mingguan tetap dibatasi game. Filter papan mencocokkan karakter dan nama senjata yang dicatat pengguna; tidak membaca inventori atau kuota akun.

Progres kartu, stamina, gacha, dan target build adalah input pengguna yang disimpan lokal. Tidak ada kartu demo otomatis. Data demo yang sudah tersimpan ditandai dan dapat dihapus dengan tindakan eksplisit. Login Google tidak digunakan; halaman masuk menyediakan mode tamu, bukan autentikasi akun yang pura-pura berhasil.

## Vercel dan pembaruan

Tidak ada scraping saat request, startup, atau build Vercel. Snapshot dan ikon ikut deployment; API eksternal mati tidak mematikan halaman. Jalankan `pnpm sync:catalog` dari root untuk memperbarui, lalu `pnpm test` dan `pnpm build` sebelum deployment. Sumber publik bukan API resmi dengan SLA, sehingga refresh yang gagal harus diperiksa sebelum mengganti snapshot.

## Akses akun yang belum terhubung

[Enka showcase API](https://github.com/EnkaNetwork/API-docs/blob/master/api.md) dapat membaca showcase UID publik, bukan seluruh roster/inventori. [genshin.py](https://seria.is-a.dev/genshin.py/) mendokumentasikan akses HoYoLAB dengan autentikasi cookie; riwayat wish membutuhkan authkey. Keduanya bukan login OAuth aplikasi. Tidak ada integrasi akun privat dalam implementasi ini.
