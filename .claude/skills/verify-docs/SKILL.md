---
name: verify-docs
description: Verifikasi konsistensi dokumen SIGAP di docs/ — keterlacakan ID lintas dokumen, tautan, sintaks Mermaid, validitas JSON dan YAML, istilah baku, dan angka yang diklaim README. Gunakan setelah mengubah dokumen apa pun di docs/, sebelum commit yang menyentuh dokumen, dan saat matriks keterlacakan perlu dipastikan utuh.
---

# Verifikasi Dokumen SIGAP

Sebelas dokumen di `docs/` saling merujuk lewat ID yang stabil. Satu penyuntingan dapat memutus rantai keterlacakan tanpa terlihat. Skill ini memeriksanya secara mekanis.

## Jalankan

```bash
python3 .claude/skills/verify-docs/scripts/verify.py docs
```

Untuk validasi diagram, sekali saja pasang dependensinya:

```bash
npm i -D mermaid jsdom
node .claude/skills/verify-docs/scripts/check-mermaid.mjs docs
```

Keduanya keluar dengan kode 1 bila ada temuan yang menghambat, sehingga dapat dipakai sebagai gerbang di CI.

## Yang diperiksa

| Pemeriksaan | Sifat temuan |
|---|---|
| Tautan antar-dokumen mengarah ke berkas yang ada | Menghambat |
| Pagar blok kode seimbang | Menghambat |
| Seluruh blok JSON valid | Menghambat |
| Seluruh blok YAML valid | Menghambat |
| ID dirujuk tapi tidak terdefinisi — FR, US, ADR, L, AG, GR, TC-AI | Menghambat |
| Setiap user story punya jejak requirement di FRD | Menghambat |
| Setiap requirement muncul di matriks keterlacakan README | Peringatan |
| Istilah baku sesuai `06-DESIGN.md §7.2` | Peringatan |
| Angka yang diklaim README cocok dengan kenyataan | Peringatan |
| Sintaks seluruh blok Mermaid | Menghambat *(skrip terpisah)* |

## Membaca hasil

**Menghambat** berarti dokumen tidak konsisten dan harus diperbaiki sebelum commit. Rujukan menggantung adalah yang paling sering: ID disebut di satu dokumen tetapi requirement-nya sudah dihapus atau dinomori ulang di dokumen lain.

**Peringatan** memerlukan pertimbangan. Dua yang lumrah:

- *Requirement belum muncul di matriks README.* Wajar untuk requirement infrastruktural yang tidak berasal dari satu user story tunggal — daftarnya ada di README bagian "Requirement tanpa user story langsung". Tambahkan ke sana bila memang begitu.
- *Angka README tidak cocok.* Perbaiki angkanya, jangan diabaikan. Angka yang basi membuat pembaca kehilangan kepercayaan pada seluruh dokumen.

## Positif palsu yang sudah ditangani

Pemeriksa istilah punya dua penyaring, dan keduanya penting untuk dipahami sebelum Anda menambah istilah baru ke daftar:

1. **Batas kata.** `peninjau` tidak menangkap `peninjauan`, karena "siklus peninjauan" adalah istilah sah yang berbeda dari peran "reviewer".
2. **Baris glosarium dilewati.** Baris yang memuat istilah salah **dan** istilah benar sekaligus dianggap baris glosarium — misalnya tabel istilah baku di `06-DESIGN.md` yang memang mendaftarkan keduanya berdampingan.

Bila menambah pasangan istilah ke `TERMS` di `verify.py`, pastikan kedua penyaring itu masih masuk akal untuk pasangan baru tersebut.

## Setelah mengubah requirement

Verifikasi mekanis tidak menangkap penyimpangan makna. Setelah menambah atau mengubah requirement, periksa manual empat hal:

1. Apakah `03-FRD.md` masih konsisten dengan mesin status yang tergambar di diagramnya sendiri?
2. Apakah `07-API-CONTRACT.md` sudah memuat titik akhir yang mendukungnya?
3. Apakah `05-UIUX-FLOW.md` sudah punya layar yang menampilkannya?
4. Apakah `10-TEST-PLAN.md` sudah punya kasus uji yang membuktikannya?

Untuk menambah requirement baru, pakai skill `add-requirement` yang menuntun keempat langkah itu.

## Di CI

```yaml
- name: Verifikasi dokumen
  run: |
    python3 .claude/skills/verify-docs/scripts/verify.py docs
    node .claude/skills/verify-docs/scripts/check-mermaid.mjs docs
```
