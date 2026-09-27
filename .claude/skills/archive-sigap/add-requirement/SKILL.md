---
name: add-requirement
description: Menambah atau mengubah requirement fungsional SIGAP tanpa memutus keterlacakan. Gunakan saat ada permintaan fitur yang belum tercakup FR mana pun, saat spec-guardian melaporkan celah lingkup, atau saat aturan bisnis pada requirement yang ada perlu berubah. Menuntun perubahan berantai di lima dokumen.
---

# Menambah Requirement SIGAP

Requirement tidak hidup sendiri. Satu FR terhubung ke sasaran bisnis di atasnya, ke titik akhir dan layar di sampingnya, dan ke kasus uji di bawahnya. Menambah FR tanpa memperbarui rantainya menghasilkan dokumen yang tampak lengkap tetapi tidak dapat dipercaya.

## Sebelum menambah

Pastikan ini memang requirement baru, bukan penafsiran atas yang sudah ada.

```bash
grep -nE '^#+ FR-[XABC]-[0-9]+' docs/03-FRD.md          # daftar seluruh requirement
grep -ni '<kata kunci>' docs/03-FRD.md                   # cari yang mirip
```

Baca requirement yang mirip **secara utuh**, bukan judulnya saja. Aturan bisnisnya sering sudah mencakup hal yang Anda kira belum ada.

Periksa juga daftar di luar lingkup: `docs/01-BRD.md §6.2` dan `docs/02-PRD.md §7`. Bila permintaan menyerempet ke sana, yang dibutuhkan adalah keputusan pemilik produk untuk memperluas lingkup, bukan requirement baru.

## Langkah

### 1. Tentukan nomor

```
FR-<modul>-<nnn>
   X = lintas modul   A = Evidence Vault
   B = Access Review  C = Policy Hub
```

Ambil nomor berikutnya yang belum dipakai pada modul itu. **Nomor tidak pernah dipakai ulang.** Requirement yang dibatalkan ditandai `[DIBATALKAN]` dan nomornya pensiun bersamanya.

### 2. Tulis requirement di `docs/03-FRD.md`

Tempatkan pada bagian modul yang benar, urut nomor. Bentuk lengkapnya:

```markdown
#### FR-B-026 · Judul singkat yang menyatakan perilaku

**Deskripsi.** Satu kalimat memakai HARUS, SEBAIKNYA, atau DAPAT.
**Aktor.** Peran yang menjalankan.
**Prakondisi.** Keadaan yang harus terpenuhi sebelumnya.
**Aturan bisnis.**
1. Aturan yang dapat diuji, bukan pernyataan niat.
2. ...

**Validasi.** Yang ditolak dan mengapa.
**Jalur pengecualian.** Yang terjadi bila prakondisi tidak terpenuhi.
**Alasan rancangan.** *(bila keputusannya tidak jelas dengan sendirinya)*
**Trace.** US-B-xx
```

**Aturan bisnis harus dapat diuji.** "Sistem harus responsif" bukan aturan bisnis. "Daftar item review memuat 10.000 baris dengan halaman pertama tampil di bawah 2 detik" adalah aturan bisnis.

**Blok "Alasan rancangan" bernilai tinggi.** Setahun lagi orang lain akan mempertanyakan keputusan ini. Tulis mengapa, bukan hanya apa.

### 3. Perbarui `docs/02-PRD.md` bila perlu

Bila belum ada user story yang menaunginya, tambahkan. Bentuknya `Sebagai / saya ingin / agar` dengan kriteria penerimaan `Diberikan / Ketika / Maka`, dan nomor `US-<modul>-<nn>` berikutnya.

Bila requirement bersifat infrastruktural dan tidak berasal dari satu user story tunggal — misalnya aturan validasi lintas sistem — tidak perlu memaksakan user story. Daftarkan di bagian "Requirement tanpa user story langsung" pada `docs/00-README.md`.

### 4. Perbarui `docs/07-API-CONTRACT.md`

Bila requirement bersifat transaksional, ia butuh titik akhir. Sertakan:

- Jalur dan metode, mengikuti konvensi `§1.2`
- Contoh muatan permintaan dan tanggapan yang **konkret**, bukan kerangka
- Kode galat yang mungkin, dari daftar `§1.7`
- Bila menyentuh aksi kritis, tambahkan ke daftar idempotensi `§1.8`

Contoh muatan yang berisi `"string"` dan `"..."` tidak berguna bagi pengembang. Tulis nilai yang masuk akal untuk domain sekuritas.

### 5. Perbarui `docs/05-UIUX-FLOW.md`

Bila ada layar baru, tambahkan `L-xx` beserta susunan, aturan, dan keadaan khususnya. Bila hanya mengubah layar yang ada, perbarui aturannya.

Jangan lupa: setiap daftar menangani lima keadaan, dan setiap keputusan berdampak tidak punya pilihan bawaan.

### 6. Perbarui `docs/10-TEST-PLAN.md`

Tambahkan kasus uji. Bila requirement menyentuh salah satu dari sepuluh kontrol kritis `§3.2`, kasus ujinya harus **aktif mencoba melanggar**, bukan hanya memastikan jalur normal bekerja.

### 7. Perbarui matriks di `docs/00-README.md`

Tambahkan baris pada tabel modul yang sesuai: `Sasaran | User story | Requirement | API | Layar`.

### 8. Verifikasi

```bash
python3 .claude/skills/verify-docs/scripts/verify.py docs
```

Harus LULUS. Peringatan "requirement belum muncul di matriks README" berarti langkah 7 terlewat.

## Mengubah requirement yang sudah ada

Berlaku aturan tambahan:

- **Jangan mengubah nomor.** Nomor mengikat dokumen lain dan kode yang sudah ditulis.
- **Periksa siapa yang merujuknya** sebelum mengubah aturan bisnisnya:

  ```bash
  grep -rn 'FR-B-012' docs/ src/ .claude/
  ```

- **Bila mengubah mesin status**, perbarui diagram Mermaid-nya. Diagram yang tidak cocok dengan teksnya lebih buruk daripada tidak ada diagram.
- **Bila melonggarkan kontrol**, jelaskan mengapa pada blok "Alasan rancangan" dan minta `security-reviewer` meninjau. Kontrol yang dilonggarkan diam-diam adalah cara paling umum sistem kepatuhan kehilangan nilainya.

## Yang tidak boleh dilakukan

- Menambah requirement yang bertentangan dengan ADR di `docs/04-TRD.md §2` tanpa mengubah ADR-nya lebih dulu
- Melemahkan salah satu dari sepuluh kontrol kritis tanpa persetujuan eksplisit
- Menciptakan istilah baru di luar daftar baku `docs/06-DESIGN.md §7.2`
- Menandai requirement sebagai HARUS padahal tidak ada yang akan menguji atau menegakkannya
