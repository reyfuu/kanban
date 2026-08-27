---
name: guardrail-audit
description: Memverifikasi bahwa perubahan pada lapisan agent AI SIGAP tidak melemahkan satu pun dari 33 guardrail. Gunakan setelah mengubah orkestrator agent, LLM Gateway, tool, validator keluaran, alur Usulan Agent, atau prompt agent. Memeriksa penegakan di kode, bukan keberadaan instruksi di prompt.
---

# Audit Guardrail Agent AI

Sumber: `docs/09-GUARDRAILS.md`.

## Pertanyaan tunggal

Untuk setiap guardrail yang tersentuh:

> **Di baris kode mana guardrail ini ditegakkan?**

Bila jawabannya "di dalam prompt", guardrail itu **belum ada**. Prompt dapat dilanggar model, dapat ditimpa isi dokumen, dan tidak dapat dibuktikan kepada auditor.

## Pemetaan cepat: perubahan → guardrail

| Yang berubah | Periksa |
|---|---|
| Registri tool | GR-0.1, GR-3.2 |
| Orkestrator, pemuat konteks | GR-0.2, GR-0.5, GR-1.3, GR-3.3 |
| Penentu rute model | GR-0.3 |
| LLM Gateway | GR-1.1, GR-1.2, GR-5.4, GR-7.1 |
| Pemuat potongan / retriever | GR-2.1, GR-2.2, GR-2.3 |
| Templat prompt | GR-3.1, GR-3.4 |
| Validator keluaran | GR-4.1 s.d. GR-4.5 |
| Alur usulan & penerimaan | GR-5.1 s.d. GR-5.3, GR-6.1 s.d. GR-6.4 |
| Metrik & pencatatan | GR-7.1 s.d. GR-7.3 |

## Delapan yang paling sering rusak diam-diam

### GR-0.1 · Tanpa tool tulis
```bash
grep -rn 'ALLOWED_TOOLS\|assertNoWriteTools' src/modules/agent/tools/
```
Cari tool baru yang menyerupai operasi tulis, kirim, atau panggil sistem luar. Verifikasi `assertNoWriteTools` dipanggil pada `onModuleInit`, bukan hanya didefinisikan.

### GR-0.2 · Agent mewarisi hak akses pemohon
Cari tool atau repositori yang dipanggil **tanpa** konteks pengguna. Satu saja cukup untuk menjadikan agent jalur peningkatan hak akses.

### GR-0.3 · Rute ditentukan data
Rute harus dihitung **setelah** konteks dimuat, dari klasifikasi tertinggi objek yang benar-benar diambil. Rute yang dibaca dari konfigurasi agent adalah pelanggaran.

Cari juga jalur penurunan:
```bash
grep -rniE 'fallback|degrade|use_external_if|allow_external' src/modules/agent/
```
Tidak boleh ada, termasuk di jalur pengujian.

### GR-1.1 · Gerbang klasifikasi
Pemeriksaan harus di servis, bukan controller. Controller dapat dilewati oleh pemanggilan internal.

### GR-2.2 · Pembumian wajib
Verifikasi sitasi memeriksa pengenal potongan terhadap **konteks yang dimuat**, bukan terhadap basis data:
```bash
grep -rn 'citation' src/modules/agent/validators/
```
Pengenal yang ada di basis data tetapi tidak dimuat berarti model mengarang rujukan yang kebetulan benar bentuknya. Itu lebih berbahaya daripada rujukan yang jelas palsu.

### GR-3.1 · Pemisahan instruksi dan data
Keluaran terikat skema **pada tingkat dekoder**, bukan diminta lewat prompt. Ini kontrol yang sebenarnya; pembungkusan penanda hanya mengurangi kemungkinan.

### GR-4.1 · Keluaran ditolak, tidak diperbaiki
Cari upaya "menyelamatkan" keluaran cacat:
```bash
grep -rniE 'repair|fix|coerce|sanitizeOutput|retry.*parse' src/modules/agent/validators/
```
Usulan cacat yang disajikan dengan peringatan akan tetap diterima sebagian pengguna.

### GR-5.1 · Usulan, bukan penulisan
```bash
grep -rn 'prisma\.\w*\.\(create\|update\|delete\)' src/modules/agent/ \
  | grep -v 'agent_proposal\|agent_run\|guardrail_result'
```
Satu-satunya jalur dari keluaran agent ke data produksi adalah `ProposalReviewService.accept()`.

## Memeriksa perubahan prompt

Prompt bukan guardrail, tetapi perubahannya tetap berdampak.

- Apakah instruksi yang dihapus punya penegakan di kode? Bila tidak, kontrolnya hilang.
- Apakah `prompt_hash` ikut berubah dan tercatat? GR-3.4 menuntut eksekusi dapat direproduksi.
- Apakah eval dijalankan ulang? `docs/10-TEST-PLAN.md §5.6` mewajibkannya untuk setiap perubahan prompt.

## Hasil

```
TERSENTUH: GR-0.3, GR-1.1, GR-4.2

GR-0.3  DITEGAKKAN  route-resolver.service.ts:34 — rute dihitung dari
                    maxClassification(loadedContext); tidak ada jalur penurunan
GR-1.1  DITEGAKKAN  llm-gateway.service.ts:61 — pemeriksaan di servis
GR-4.2  LEMAH       citation.validator.ts:47
                    Pemeriksaan keberadaan potongan memakai chunkRepo.exists(),
                    bukan loadedContext.chunkIds. Rujukan yang dikarang tetapi
                    kebetulan valid akan lolos.
                    → Ganti ke pemeriksaan terhadap konteks yang dimuat.

EVAL: perlu dijalankan ulang (prompt AG-5 berubah)
```

Guardrail berstatus LEMAH atau HILANG menahan perubahan dari merge. Untuk guardrail yang menegakkan dimensi eval bertanda mutlak — GR-1.1, GR-1.2, GR-1.4, GR-4.2, GR-4.3 — tidak ada pengecualian yang dapat disetujui.

Setelah audit lulus, jalankan skill `run-eval` bila prompt atau model berubah.
