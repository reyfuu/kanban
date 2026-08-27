# HANDOFF — SIGAP

Status per **27 Agustus 2026**. Dokumen ini untuk orang berikutnya yang melanjutkan, termasuk Anda sendiri beberapa minggu lagi.

---

## 1. Posisi saat ini

**Proyek:** SIGAP — Sistem Integrasi Governance, Akses, dan Prosedur, untuk PT Trimegah Sekuritas Indonesia Tbk.

Tiga modul dengan satu penyimpanan bukti bersama: manajemen bukti audit (A), review hak akses lintas aplikasi (B), pencarian SOP dan kebijakan (C).

**Tahap:** dokumentasi selesai, **implementasi belum dimulai**. Tidak ada kode aplikasi, tidak ada `package.json`, tidak ada skema Prisma. Fase 1 belum jalan.

**Repo:** `/home/reyfuu/ai-assitant`, git di cabang `main`, dua commit, working tree bersih.

```
docs/          11 dokumen · 10.156 baris · sumber kebenaran
.claude/       9 subagent + 6 skill · harness pengembangan
brand/         kosong, menunggu brand guideline
CLAUDE.md      aturan kerja yang mengikat
```

---

## 2. Yang menghambat

### 2.1 Kunci API Gemini perlu dicabut — belum dikonfirmasi selesai

Sebuah kunci API Gemini pernah dikirim dalam bentuk teks biasa melalui percakapan. Kunci itu **tidak pernah ditulis ke berkas mana pun** dan repo sudah dipindai bersih sebelum commit.

Tetap harus dicabut dan diterbitkan ulang. Kredensial yang pernah terekspos dianggap bocor terlepas dari siapa yang melihatnya — dan untuk perusahaan efek, itu bukan formalitas.

- [ ] Cabut kunci lama di Google AI Studio / Google Cloud Console
- [ ] Terbitkan kunci baru, simpan di penyimpanan rahasia — bukan `.env` yang di-commit, bukan chat, bukan tiket
- [ ] Catat sebagai pemenuhan syarat **G3** pada [ADR-03](docs/04-TRD.md)

### 2.2 Brand guideline Trimegah belum diterima

Dikirim dua kali, lampirannya tidak sampai. Folder `brand/` sudah disiapkan beserta daftar kebutuhannya.

Akibatnya token `--tri-*` pada [06-DESIGN §2.0](docs/06-DESIGN.md) sengaja **dikosongkan**. Aturan penerapannya sudah lengkap dan tidak perlu menunggu; hanya nilainya yang kosong.

**Jangan menebak nilai warna dari tangkapan layar situs.** Kesalahan warna merek pada dokumen resmi lebih mahal daripada penundaan.

Yang dibutuhkan minimal: heksadesimal primer/sekunder/aksen, nama tipografi beserta bobot, logo SVG terang dan gelap, aturan zona aman.

---

## 3. Keputusan terbuka

Daftar lengkap 19 butir ada di [00-README](docs/00-README.md) bagian akhir. Empat yang paling menentukan:

| # | Pertanyaan | Pemilik | Kalau salah |
|---|---|---|---|
| **Q-08** | Apakah anak usaha — antara lain Trimegah Asset Management — ikut memakai SIGAP? | Direksi & TI | **Mengubah arsitektur secara mendasar.** Rancangan sekarang mengasumsikan satu badan hukum. Multi-entitas menuntut pemisahan data antar-entitas dan konsolidasi laporan tingkat grup. Harus dijawab **sebelum Fase 1**, bukan nanti |
| **QA-01** | Anggaran satu peladen GPU 48 GB | Divisi TI | **Belum masuk sizing di [TRD §6.3](docs/04-TRD.md).** Tanpa GPU, AG-2, AG-3, dan AG-5 gugur; tersisa AG-1, AG-4, AG-6 |
| **G1–G7** | Tujuh syarat kepatuhan Gemini | Kepatuhan & TI | AG-1 tidak boleh diaktifkan sebelum ketujuhnya terpenuhi dan dibuktikan |
| **Q-03** | Masa retensi bukti — 5 atau 10 tahun menurut ketentuan sektor efek | Kepatuhan | Memengaruhi kebijakan penguncian objek dan kapasitas penyimpanan |

Selain itu, angka biaya kondisi saat ini di [BRD §3](docs/01-BRD.md) masih **estimasi berbasis asumsi tertulis**, bukan hasil pengukuran. Perlu *time study* singkat pada satu siklus audit dan satu siklus UAR sebelum dibawa ke Steering Committee.

---

## 4. Cara melanjutkan

### Verifikasi keadaan sehat

```bash
python3 .claude/skills/verify-docs/scripts/verify.py docs
```

Harus `HASIL: LULUS`, exit 0. Jalankan setiap kali dokumen berubah, sebelum commit.

Untuk validasi diagram, sekali saja: `npm i -D mermaid jsdom`, lalu

```bash
node .claude/skills/verify-docs/scripts/check-mermaid.mjs docs
```

### Alur kerja yang sudah disiapkan

| Situasi | Yang dipakai |
|---|---|
| Mau mulai pekerjaan apa pun | Subagent `spec-guardian` — pastikan ada ID requirement-nya |
| Permintaan belum tercakup FR mana pun | Skill `add-requirement` |
| Menulis backend / frontend / migrasi | Subagent `backend-impl` / `frontend-impl` / `db-migrator` |
| Membangun agent AI produk | Subagent `agent-builder`, lalu skill `guardrail-audit` |
| Setelah menyentuh kontrol kritis | Skill `critical-controls`, lalu subagent `security-reviewer` |
| Sebelum mengaktifkan agent | Skill `run-eval` |
| Dokumen berubah | Subagent `doc-sync`, lalu skill `verify-docs` |

### Bila implementasi dimulai

Urutan yang masuk akal, sesuai roadmap [BRD §11](docs/01-BRD.md):

1. **Jawab Q-08 dulu.** Menunda ini berarti berisiko membongkar model data setelah kode ditulis.
2. Fondasi Fase 1: autentikasi AD, peran, jejak audit, penyimpanan objek. Ketiga yang pertama tidak dapat ditambahkan belakangan tanpa membongkar sistem.
3. Modul C, lalu AG-1 setelah G1–G7 terpenuhi.

---

## 5. Hal yang mudah disalahpahami

Ini yang tidak terlihat dari membaca dokumen saja.

**Dokumen adalah sumber kebenaran, bukan catatan pendukung.** Kode mengikuti dokumen. Kalau berbeda, salah satunya diperbaiki secara sadar — bukan dibiarkan.

**Sepuluh kontrol kritis (K-1..K-10) bukan daftar keinginan.** Kesepuluhnya adalah alasan sistem ini dibangun. Yang paling mudah dilanggar tanpa sadar:

- **K-1** — tiket pencabutan tidak punya jalur penutupan manual. Ketiadaan tombol itu disengaja. Jangan menambahkannya "untuk memudahkan pengujian"; pakai penyuntikan snapshot.
- **K-2** — komponen keputusan tidak menerima properti nilai bawaan. Ketiadaan properti itu adalah kontrolnya.
- **K-5** — pencarian menyaring hak akses **sebelum** memeringkat. Kalau dibalik, jumlah hasil membocorkan keberadaan dokumen rahasia walau isinya tidak pernah tampil.
- **K-10** — agent tidak punya tool tulis. Bukan dilarang lewat prompt; tool-nya memang tidak ada, dan `assertNoWriteTools` membuat aplikasi gagal menyala kalau ada yang menambahkan.

**Guardrail yang hanya ada di prompt bukan guardrail.** Setiap kontrol pada [09-GUARDRAILS](docs/09-GUARDRAILS.md) wajib punya penegakan di kode. Kalau Anda tidak bisa menunjuk barisnya, kontrol itu belum ada.

**Rute model ditentukan klasifikasi data, bukan konfigurasi.** Kalau model lokal mati, agent tidak jalan. Tidak ada jalur penurunan ke Gemini — dan jangan pernah menyediakannya, termasuk sebagai flag pengujian.

**Delapan dimensi eval bertanda mutlak tidak bisa dilonggarkan.** Kebocoran klasifikasi, kebocoran data pribadi, penyisipan instruksi yang berhasil, kriteria temuan tanpa sitasi, dan empat lainnya. Satu penyimpangan menahan agent dari produksi. Jangan pernah melonggarkan "sementara".

**Pemeriksa istilah di `verify.py` punya tiga penyaring positif palsu** yang harus dipahami sebelum menambah pasangan istilah baru: batas kata (agar "peninjauan" tidak tertangkap "peninjau"), lewati baris glosarium, dan lewati tabel yang kepala kolomnya memuat "salah" atau "tidak dipakai". Ketiganya ada alasannya, dijelaskan di [SKILL.md](.claude/skills/verify-docs/SKILL.md).

**Angka endpoint yang benar 187.** Versi pertama skrip menghitung 189 karena variasi spasi penjajaran kolom. Sudah diperbaiki; sebutkan ini kalau ada yang menemukan angka berbeda di catatan lama.

---

## 6. Riwayat singkat

| Commit | Isi |
|---|---|
| `acdb6e3` | Sebelas dokumen produk dan teknis, plus harness pengembangan: 9 subagent, 6 skill, `CLAUDE.md` |
| `3834e65` | Kontekstualisasi Trimegah: ADR-03 menetapkan Gemini dengan syarat G1–G7, DESIGN §2.0 lapisan merek, ASM-01 ditandai perlu konfirmasi, domain contoh diganti |

Referensi produk sejenis yang ditelaah saat perancangan ada di [BRD Lampiran A](docs/01-BRD.md) dan [00-README](docs/00-README.md).

---

## 7. Berikutnya

Tiga hal, berurutan:

1. **Cabut kunci API.** Tidak menunggu apa pun.
2. **Jawab Q-08.** Memblokir keputusan arsitektur.
3. **Kirim brand guideline** ke `brand/`, lalu isi token `--tri-*` dan periksa kontras setiap pasangan terhadap ambang 4,5:1.

Setelah ketiganya, dokumen siap dibawa ke Steering Committee — dengan catatan bahwa angka biaya di BRD masih perlu divalidasi lewat *time study*.
