---
name: critical-controls
description: Memeriksa perubahan kode SIGAP terhadap sepuluh kontrol kritis (K-1 sampai K-10) sebelum merge. Gunakan setiap kali diff menyentuh otorisasi, jejak audit, gerbang klasifikasi, integritas bukti, mesin kampanye, keputusan review, verifikasi pencabutan, atau agent AI. Bukan review gaya kode — hanya memeriksa apakah kontrol masih utuh.
---

# Sepuluh Kontrol Kritis SIGAP

Kesepuluh kontrol ini adalah alasan sistem dibangun. Kegagalan pada salah satunya membuat SIGAP kehilangan nilainya, terlepas dari seberapa baik sisanya berjalan — dan akan menjadi temuan audit atas sistemnya sendiri.

Sumber: `docs/10-TEST-PLAN.md §3.2`.

## Cara pakai

```bash
git diff --stat HEAD
git diff HEAD -- 'src/**' 'prisma/**'
```

Tentukan kontrol mana yang tersentuh, lalu periksa hanya bagian itu. Memeriksa seluruh sepuluh untuk perubahan kosmetik hanya menghasilkan kebisingan.

## Daftar periksa

### K-1 · Tiket pencabutan tidak dapat ditutup manual
`FR-B-019` · Modul B

- [ ] Tidak ada titik akhir yang menerima `status` sebagai masukan bebas pada tiket
- [ ] Peta perpindahan status tidak memuat jalur langsung ke `TERVERIFIKASI_TERTUTUP`
- [ ] Satu-satunya penulis status itu adalah pekerjaan verifikasi berbasis snapshot
- [ ] Uji memakai penyuntikan snapshot, bukan jalan pintas menulis status

**Mengapa penting.** Tanpa ini, Modul B hanya memindahkan spreadsheet ke layar tanpa memberi jaminan tambahan.

### K-2 · Tanpa pilihan bawaan pada keputusan review
`FR-B-012` aturan 1 · Modul B

- [ ] Komponen `KendaliKeputusan` tidak menerima properti nilai bawaan
- [ ] State awal `null`, bukan keputusan siklus sebelumnya
- [ ] Keputusan siklus lalu ditampilkan sebagai informasi, tidak sebagai nilai terpilih
- [ ] Peladen menolak keputusan tanpa nilai eksplisit

**Mengapa penting.** Bila ada pilihan default, mayoritas reviewer akan menerimanya, dan kampanye kehilangan maknanya sebagai kontrol.

### K-3 · Alasan wajib pada akses istimewa
`FR-B-012` aturan 3 · Modul B

- [ ] Validasi alasan berada di peladen, bukan hanya di klien
- [ ] Pemeriksaan `is_privileged` dan `risk_level` tidak dapat dilewati cabang mana pun
- [ ] Alasan minimal 10 karakter, bukan pengulangan satu karakter
- [ ] Berlaku juga untuk keputusan `PERTAHANKAN`, bukan hanya `CABUT`

### K-4 · Item berisiko dikecualikan dari aksi massal
`FR-B-013` · Modul B

- [ ] Kelayakan aksi massal dihitung di peladen, bukan hanya ditandai di klien
- [ ] Titik akhir massal memvalidasi ulang setiap item, tidak percaya daftar dari klien
- [ ] Batas 50 item sekali terap ditegakkan
- [ ] Item tertolak dikembalikan beserta alasannya, bukan gagal senyap
- [ ] Penanda keputusan massal tersimpan dan muncul pada paket bukti

### K-5 · Penyaringan hak akses sebelum pemeringkatan
`FR-C-010` · Modul C

- [ ] Kueri menyaring di CTE paling awal, sebelum peringkat dihitung
- [ ] Penyaringan disertakan pada **kedua** cabang pencarian, kata kunci dan makna
- [ ] Jumlah pada penyaring dihitung setelah penyaringan hak akses
- [ ] Saran ejaan tidak dibangun dari dokumen yang tidak boleh diakses

**Mengapa penting.** Jumlah hasil yang berbeda membocorkan keberadaan dokumen rahasia, walaupun isinya tidak pernah ditampilkan.

### K-6 · Gerbang klasifikasi tidak dapat dilewati
`FR-C-014` · Lintas modul

- [ ] Pemeriksaan berada di lapisan servis, bukan controller
- [ ] Tidak ada jalur ke penyedia eksternal yang melewati gateway
- [ ] Rute dihitung dari klasifikasi objek yang benar-benar dimuat
- [ ] Tidak ada jalur penurunan dari rute lokal ke eksternal, termasuk flag pengujian
- [ ] Kegagalan redaksi membatalkan pengiriman, tidak meneruskannya

### K-7 · Jejak audit tidak dapat diubah
`FR-X-008`, `ADR-04` · Lintas modul

- [ ] Pemicu penolakan `UPDATE`/`DELETE` pada `audit_log` masih ada
- [ ] Akun basis data aplikasi tidak punya hak `UPDATE`/`DELETE` di tabel itu
- [ ] Setiap operasi tulis baru mencatat jejak audit **dalam transaksi yang sama**
- [ ] Kegagalan menulis jejak audit membatalkan transaksi bisnis
- [ ] Rantai `hash`/`prev_hash` tidak putus
- [ ] Kata sandi, token, dan kunci disamarkan pada `before`/`after`

### K-8 · Integritas bukti
`FR-A-011` · Modul A

- [ ] SHA-256 dihitung saat penerimaan dan diverifikasi saat pengunduhan
- [ ] Versi lama tidak pernah ditimpa
- [ ] Indeks unik `(evidence_id, sha256)` masih ada
- [ ] Penguncian objek diterapkan selama masa retensi
- [ ] Ketidakcocokan sidik jari memicu peringatan keamanan

### K-9 · Sign-off mengunci keputusan
`FR-B-015` · Modul B

- [ ] Sign-off menuntut autentikasi ulang
- [ ] Setelah ditandatangani, keputusan tidak dapat diubah tanpa pembukaan kembali resmi
- [ ] Pembukaan kembali menuntut alasan dan tercatat; sign-off lama tetap tersimpan
- [ ] Sidik jari isi yang ditandatangani tersimpan

### K-10 · Agent tidak dapat menulis ke produksi
`GR-0.1` · Modul agent

- [ ] `assertNoWriteTools` dipanggil saat aplikasi menyala
- [ ] Registri tool tidak memuat operasi tulis, kirim, atau panggil sistem luar
- [ ] Agent tidak memanggil servis yang menulis
- [ ] Satu-satunya jalur ke produksi adalah `ProposalReviewService.accept()`
- [ ] Agent berjalan dengan hak akses pemohon, bukan akun layanan

## Hasil

```
TERSENTUH: K-1, K-7
K-1  UTUH     Peta perpindahan tidak memuat jalur manual; DTO tidak menerima status
K-7  RETAK    src/modules/access/services/ticket.service.ts:88
              Pembaruan tiket tidak mencatat jejak audit.
              → Bungkus dalam transaksi bersama auditLog.record()

TIDAK TERSENTUH: K-2 s.d. K-6, K-8 s.d. K-10
```

Satu kontrol retak berarti perubahan **belum siap merge**, terlepas dari lulusnya tes lain. Bila ragu apakah sebuah kontrol tersentuh, anggap tersentuh dan periksa.

Untuk perubahan yang menyentuh K-6, K-7, atau K-10, lanjutkan ke subagent `security-reviewer` — daftar periksa ini menangkap pelanggaran yang terlihat, review adversarial menangkap yang tersembunyi.
