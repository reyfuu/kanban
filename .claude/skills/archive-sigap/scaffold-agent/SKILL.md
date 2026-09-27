---
name: scaffold-agent
description: Membuat kerangka agent AI produk SIGAP baru mengikuti pola Usulan Agent. Gunakan saat menambah agent di luar AG-1 sampai AG-6, atau saat mengimplementasikan salah satunya dari nol. Menuntun penentuan rute model, tool baca-saja, skema keluaran, guardrail yang berlaku, dan dimensi eval.
---

# Scaffold Agent Produk SIGAP

Sebelum membuat agent, pastikan pekerjaannya memang layak dijadikan agent.

## Tiga syarat

Sebuah pekerjaan layak menjadi agent hanya bila ketiganya terpenuhi:

1. **Keluarannya berupa pertimbangan, bukan perhitungan.** Rekonsiliasi, verifikasi pencabutan, dan evaluasi aturan SoD bersifat deterministik dan hasilnya harus dapat dibuktikan kepada auditor. Memindahkannya ke model bahasa menambah biaya, menambah ketidakpastian, dan menghapus kemampuan membuktikan.
2. **Masukannya tidak terstruktur atau setengah terstruktur.**
3. **Kesalahannya dapat dikoreksi manusia sebelum berdampak.**

Bila salah satu tidak terpenuhi, buat pekerjaan terjadwal biasa.

## Yang tidak boleh dijadikan agent

Keputusan review akses, sign-off, pengesahan dokumen, penutupan tiket pencabutan, dan penutupan temuan. Pada kelimanya, pertanggungjawaban manusia **adalah produknya** — mengotomasinya menghapus alasan sistem ini dibangun. Daftar lengkap di `docs/08-AGENT-SPEC.md §1.3`.

## Langkah

### 1. Tentukan nomor dan sifat

`AG-<n>` berikutnya. Isi tabel ini sebelum menulis kode:

| Bidang | Nilai |
|---|---|
| Tujuan | Satu kalimat |
| Persona yang dilayani | Dari `docs/02-PRD.md §3` |
| Pemicu | Permintaan pengguna atau peristiwa sistem |
| Requirement | FR yang didukung |
| Sifat keluaran | Usulan yang ditelaah, atau informasi yang langsung tampil |
| Tingkat risiko | Rendah / Sedang / Tinggi |

**Keluaran yang langsung tampil hanya dapat diterima bila bersifat informatif dan tidak mengubah data**, dan hanya bila setiap pernyataannya membawa rujukan yang dapat diverifikasi pembaca saat itu juga. AG-1 dan AG-4 memenuhi syarat ini; AG-2, AG-3, AG-5, AG-6 tidak.

### 2. Tentukan rute model

Bukan pilihan preferensi. Ditentukan klasifikasi tertinggi data yang disentuh:

| Klasifikasi tertinggi | Rute |
|---|---|
| Publik atau Internal | Eksternal lewat gerbang diperbolehkan |
| Terbatas atau Rahasia | **Lokal, wajib** |

Bila agent kadang menyentuh data tinggi dan kadang tidak, rute dihitung per eksekusi dari objek yang benar-benar dimuat — bukan ditetapkan di konfigurasi. Lihat AG-4 sebagai contoh pola kondisional.

### 3. Tentukan tool

Hanya dari daftar yang sudah ada di `docs/08-AGENT-SPEC.md §2.2`. Bila butuh tool baru:

- **Wajib baca-saja.** Tanpa pengecualian.
- Menerapkan penyaringan hak akses pemohon **di dalam implementasinya**, bukan di pemanggil.
- Ditambahkan ke daftar putih `ALLOWED_TOOLS`; `assertNoWriteTools` akan memblokir yang menyerupai operasi tulis.

### 4. Rancang skema keluaran

Skema mengikat pada tingkat dekoder, bukan diminta lewat prompt. Sertakan selalu:

```jsonc
{
  // isi khusus agent
  "confidence": "TINGGI | SEDANG | RENDAH",
  // wajib bila keluaran memuat pernyataan faktual
  "citations": [{ "document_id": "uuid", "chunk_id": "uuid", "section_ref": "string", "supports": "string" }],
  // bidang yang menyatakan ketidakcukupan — jangan dihilangkan
  "insufficient_reason": "string | null"
}
```

**Sediakan jalan bagi agent untuk menyatakan tidak tahu.** Skema yang tidak punya bidang ini memaksa model mengarang. Bidang `supports` menyebut kalimat mana yang didukung rujukan tersebut — inilah yang memungkinkan verifikasi sitasi otomatis pada GR-4.2.

### 5. Tentukan larangan keluaran

Setiap agent punya larangan spesifik yang ditegakkan validator, bukan diminta di prompt. Tanyakan: **kesalahan apa yang paling merusak bila agent ini keliru?** Jadikan itu larangan.

Contoh dari agent yang sudah ada:

| Agent | Larangan | Alasan |
|---|---|---|
| AG-3 | Mengusulkan penutupan atau pengecualian anomali | Penilaian yang harus dipertanggungjawabkan manusia |
| AG-5 | Kriteria tanpa sitasi | Kriteria yang dikarang adalah kegagalan terparah |
| AG-6 | `PENUH` berkeyakinan rendah | Asimetri konsekuensi — diturunkan otomatis ke `SEBAGIAN` |

Bila konsekuensi salah ke satu arah jauh lebih berat daripada ke arah lain, jadikan asimetri itu aturan, jangan serahkan ke model.

### 6. Buat struktur berkas

```
src/modules/agent/agents/ag<n>-<nama>/
  ag<n>.agent.ts          # definisi: tool, skema, batas, rute
  ag<n>.prompt.ts         # templat, berversi, hash-nya tercatat
  ag<n>.validator.ts      # larangan keluaran khusus agent ini
  ag<n>.mapper.ts         # keluaran model -> proposal_payload
  __tests__/
```

### 7. Daftarkan guardrail yang berlaku

Sebagian besar berlaku otomatis dari lapisan bersama. Yang perlu ditentukan per agent:

- GR-1.3 batas cakupan masukan — jumlah objek dan token
- GR-3.3 batas langkah dan waktu
- GR-5.3 batas penerimaan massal, atau larangan penuh
- GR-6.1 peran penelaah yang sah

Isi matriks di `docs/09-GUARDRAILS.md §12`.

### 8. Tentukan dimensi eval dan ambangnya

Tambahkan ke `docs/10-TEST-PLAN.md §5.2`. Untuk setiap larangan pada langkah 5, buat dimensi eval bertanda **mutlak** dengan ambang nol — itu yang membuat larangan dapat diukur.

Siapkan dataset acuannya. Jawaban acuan divalidasi manusia yang berwenang atas materinya, bukan oleh model.

### 9. Perbarui dokumen

- `docs/08-AGENT-SPEC.md` — bagian §3 agent baru, tabel perbandingan §4, urutan peluncuran §5
- `docs/09-GUARDRAILS.md` — matriks §12, mode kegagalan §10
- `docs/10-TEST-PLAN.md` — dimensi eval, dataset, kasus uji guardrail
- `docs/00-README.md` — tabel agent pada matriks keterlacakan

Lalu:
```bash
python3 .claude/skills/verify-docs/scripts/verify.py docs
```

### 10. Gerbang peluncuran

Agent baru **tidak langsung aktif untuk seluruh pengguna**. Syaratnya:

- Seluruh dimensi eval memenuhi ambang
- Red team manual dijalankan
- Uji coba terbatas pada satu unit minimal dua minggu
- Tingkat penerimaan usulan pada uji coba memenuhi kriteria keberhasilan agent

Urutkan peluncuran agent berisiko rendah lebih dulu, agar organisasi terbiasa menelaah usulan sebelum menghadapi agent berisiko tinggi.
