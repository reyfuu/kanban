# 📊 Progress Implementasi SIGAP

> Status per **28 Agustus 2026** · Commit `d0e8d96`

---

## Ringkasan Cepat

| Area | Progress |
|---|---|
| Infrastruktur & Fondasi | ✅ ~100% |
| Database Schema | ✅ ~100% (28 model) |
| Modul B — Access Review | 🟡 ~60% |
| Modul A — Evidence Vault | 🟢 ~89% (16/18 FR) |
| Modul C — Policy Hub | 🟢 ~82% (18/22 FR) |
| Cross-cutting (FR-X) | 🟡 ~45% |
| **Keseluruhan (dari total FRD)** | **~75–80%** |

---

## Breakdown per Area

### ✅ Fondasi (100%)

- NestJS 11 API skeleton + modul shared (auth, audit, authz, redis, prisma)
- Next.js 15 web skeleton + layout berautentikasi
- Prisma schema 28 model, 2 migrasi
- Docker Compose infra (Postgres, Redis, Minio)
- CI gerbang mutu: lint, typecheck, 203 tes, `verify:docs`
- ADR, dokumentasi 11 dokumen lengkap

---

### 🟡 FR-X — Cross-cutting (18 FR) · ~45%

| FR | Fitur | Status |
|---|---|---|
| FR-X-001 | Autentikasi AD/LDAP | ⚠️ Hanya identity provider demo |
| FR-X-002 | Pengelolaan sesi | ⚠️ Token buram, bukan JWT+refresh; no remote kill |
| FR-X-003 | Autentikasi ulang (step-up) | ✅ Jalan |
| FR-X-004 | Akun eksternal AUDITOR_EXT | ❌ Belum ada |
| FR-X-005 | Model peran & hak akses | ✅ Jalan |
| FR-X-006 | Pemisahan tugas internal SIGAP | ✅ Ditegakkan |
| FR-X-007 | Pendelegasian wewenang | ⚠️ Bisa memutuskan, tapi sign-off belum teruji |
| FR-X-008 | Pencatatan jejak audit | ✅ Jalan (180 baris, chain verified) |
| FR-X-009 | Penelusuran riwayat objek | ✅ Layar jejak-audit jalan |
| FR-X-010 | Mesin notifikasi | ❌ Belum ada |
| FR-X-011 | Matriks notifikasi | ❌ Belum ada |
| FR-X-012 | Pencarian global | ❌ Belum ada |
| FR-X-013 | Penanganan unggahan berkas | ✅ Jalan (CSV upload snapshot) |
| FR-X-014 | Pratinjau berkas | ❌ Belum ada |
| FR-X-015 | Pembuatan laporan asinkron | ❌ Belum ada |
| FR-X-016 | Daftar laporan standar | ❌ Belum ada |
| FR-X-017 | Struktur organisasi & karyawan | ⚠️ Model ada, `employee_history` belum |
| FR-X-018 | Klasifikasi informasi | ❌ Belum ada |

**~7–8 dari 18 FR-X selesai/parsial → ~42%**

---

### 🟡 Modul B — Access Review (25 FR) · ~55–60%

| FR | Fitur | Status |
|---|---|---|
| FR-B-001 | Pendaftaran aplikasi | ✅ Registri aplikasi jalan |
| FR-B-002 | Katalog hak akses | ✅ Jalan |
| FR-B-003 | Kerangka konektor | ❌ Skema saja, nol kode |
| FR-B-004 | Unggah data akses via berkas | ✅ Jalan (CSV, validasi, konfirmasi) |
| FR-B-005 | Snapshot akses | ✅ Jalan (daftar, rincian, perbandingan) |
| FR-B-006 | Pemetaan akun ke karyawan | ⚠️ Aturan 1&4 saja; 2&3 belum (tabel pemetaan belum ada) |
| FR-B-007 | Deteksi akun berisiko | ⚠️ Anomali ditanam manual; mesin deteksi belum ada |
| FR-B-008 | Penyusunan kampanye | ✅ Jalan (susun, pratinjau, luncurkan, perpanjang, batalkan) |
| FR-B-009 | Aturan penugasan reviewer | ⚠️ RA-01/02/03/05 jalan; RA-04 sengaja tidak |
| FR-B-010 | Siklus hidup kampanye | ✅ Jalan |
| FR-B-011 | Item review | ✅ Jalan |
| FR-B-012 | Keputusan reviewer | ✅ Jalan (K-2, K-3, K-4) |
| FR-B-013 | Keputusan massal dengan pengaman | ✅ Jalan |
| FR-B-014 | Deteksi pola persetujuan asal-asalan | ⚠️ `seconds_spent` dicatat, mesin deteksi belum |
| FR-B-015 | Sign-off kampanye | ✅ Jalan (K-9, step-up) |
| FR-B-016 | Pemantauan kampanye | ✅ Layar kampanye jalan |
| FR-B-017 | Perlakuan khusus akses istimewa | ⚠️ Sign-off 2 lapis belum teruji |
| FR-B-018 | Pembentukan tiket pencabutan | ✅ Jalan (K-1) |
| FR-B-019 | Siklus hidup tiket | ✅ Layar tiket jalan |
| FR-B-020 | Verifikasi otomatis pencabutan | ⚠️ Kode ada, penjadwal (cron) belum jalan |
| FR-B-021 | Verifikasi ad-hoc | ✅ Jalan |
| FR-B-022 | Paket bukti kampanye | ❌ Belum ada |
| FR-B-023 | Penautan ke Modul A | ❌ Belum ada (Modul A belum ada) |
| FR-B-024 | Aturan konflik SoD | ⚠️ Aturan ditanam; mesin deteksi otomatis belum ada |
| FR-B-025 | Pengecualian SoD | ❌ Belum ada |

**~14–15 dari 25 FR-B selesai/parsial → ~57%**

---

### 🟢 Modul A — Evidence Vault (18 FR) · ~89%

16 dari 18 FR-A terbangun, dengan 4 berkas uji integrasi (`evidence-*.test.ts`).

- FR-A-001 s.d. 003 · pustaka kontrol, framework, pemetaan cakupan
- FR-A-004, 005 · penugasan dan siklus hidupnya
- FR-A-006, 007, 009 · permintaan bukti (PBC) dan daftar tugas PIC
- FR-A-010, 011, 013, 014 · bukti sebagai entitas mandiri, versi + integritas (K-8)
- FR-A-015 · retensi, penahanan hukum, antrean penghapusan
- FR-A-016, 017 · temuan dan tindak lanjut
- FR-A-018 · portal auditor eksternal

**Belum:** FR-A-008 dan FR-A-012 tidak dirujuk di kode mana pun. Juga tertunda:
object-lock penyimpanan yang membuat K-8 aturan 3 bersifat fisik, bukan sekadar
ditegakkan aplikasi.

---

### 🟢 Modul C — Policy Hub (22 FR) · ~82%

18 dari 22 FR-C terbangun dan teruji. Yang tersisa adalah satu blok yang koheren,
bukan sisa-sisa yang tersebar: seluruhnya bergantung pada LLM Gateway (ADR-03).

**Terbangun (18).**

| FR | Cakupan | Bukti |
|---|---|---|
| FR-C-001, 002 | Jenis dokumen, hierarki normatif, 12 bidang proses | `schema.prisma` enum `ProcessArea`, `document-rules.ts` |
| FR-C-003, 004 | Pembuatan dokumen; siklus Draf → Berlaku → Digantikan/Ditarik | `document.service.ts`, `POST /documents`, `/transisi` |
| FR-C-005 | Alur telaah & pengesahan berjenjang, autentikasi ulang, delegasi | `document-approval.service.ts`, `policy-approval.integration.test.ts` |
| FR-C-006, 007 | Versi mayor.minor, jendela berlaku, "versi mana yang berlaku pada tanggal X" | `document-diff.ts`, `/berlaku-pada`, `/bandingkan` |
| FR-C-008 | Tinjauan berkala; dokumen telat tinjau TETAP berlaku | `/tinjauan-terlambat`, `/tetap-berlaku` |
| FR-C-009 s.d. 012 | Pencarian hibrida, penyaringan hak akses, penyaring + jumlah, hasil kosong | `document-search.repository.ts`, `check_document_access` |
| FR-C-019 s.d. 021 | Kampanye attestation, pencatatan pernyataan + bukti, pemantauan | `attestation.service.ts`, `policy-attestation.integration.test.ts` |
| FR-C-022 | Penautan dokumen ke kontrol Modul A | `POST /documents/:id/kontrol` |

**Belum (4) — semuanya menunggu LLM Gateway.**

| FR | Isi | Kenapa terblokir bersama |
|---|---|---|
| FR-C-013 | Pembentukan jawaban dari potongan dokumen | Butuh pemanggilan model |
| FR-C-014 | Gerbang klasifikasi keluar (Publik/Internal saja) | Gerbang atas panggilan yang belum ada |
| FR-C-016 | Pencatatan gerbang: muatan, token, biaya, penolakan | Mencatat panggilan yang belum ada |
| FR-C-017 | Pemutus layanan bagi `COMPLIANCE` | Mematikan fitur yang belum ada |

> [!NOTE]
> FR-C-015 (redaksi data sensitif) dan FR-C-018 (kemandirian penyedia) tidak
> masuk daftar tertunda dengan alasan berbeda. `redactSensitive` sudah ada dan
> teruji, tetapi ditulis untuk FR-X-008 (audit log), bukan untuk pola FR-C-015
> (NIK, rekening efek, kartu identitas) — jadi mekanismenya ada, polanya belum.
> FR-C-018 terpenuhi secara struktural: fitur jawaban absen dan seluruh modul
> lain tetap utuh, yang persis aturan 2-nya.

**Artinya untuk pertanyaan "apakah Modul C sudah selesai".** Belum seluruhnya,
tetapi bagian yang bisa berdiri tanpa layanan eksternal sudah selesai. Policy Hub
dapat dipakai end-to-end hari ini: menyusun dokumen, mengesahkan berjenjang,
mencari dengan penyaringan hak akses, dan menjalankan kampanye attestation.
Yang hilang adalah lapisan tanya-jawab otomatis di atasnya.

---

## Perhitungan Total

| Modul | FR total | FR selesai/parsial | Bobot |
|---|---|---|---|
| FR-X (cross-cutting) | 18 | ~8 | 22% scope |
| Modul B (Access Review) | 25 | ~15 | 30% scope |
| Modul A (Evidence Vault) | 18 | 16 | 22% scope |
| Modul C (Policy Hub) | 22 | 18 | 26% scope |
| **Total** | **83** | **~64** | |

### 🎯 Estimasi Overall: **~75–80%** dari total FRD

> Kalau hanya menghitung **Modul B yang jadi target demo**, progressnya jauh lebih tinggi: **~57–60%**.

---

## Catatan Penting

> [!IMPORTANT]
> Fondasi dan infrastruktur solid: 203 tes lulus, rantai audit terverifikasi,
> kontrol kritis K-1 s.d. K-9 teruji adversarial. Modul A dan C — yang versi
> sebelumnya laporan ini sebut "nol implementasi" — kini masing-masing 16/18 dan
> 18/22 FR terbangun. Modul B justru menjadi yang paling tertinggal.

> [!WARNING]
> Sisa pekerjaan tidak tersebar merata, melainkan mengelompok pada empat hal:
> **(1)** LLM Gateway, yang menahan seluruh FR-C-013/014/016/017; **(2)** mesin
> deteksi Modul B (akun berisiko, persetujuan asal-asalan, konflik SoD) yang
> aturannya sudah ada tetapi belum dijalankan otomatis; **(3)** notifikasi dan
> laporan, yang belum ada sama sekali (FR-X-010, 011, 015, 016); **(4)** AD/LDAP
> sungguhan — saat ini memakai identity provider demo.

> [!NOTE]
> Angka persentase di laporan ini dihitung dari rujukan `FR-x-nnn` di dalam kode
> dan skema, lalu diperiksa silang dengan berkas uji. Itu berarti sebuah FR
> dihitung "terbangun" bila ada kode yang menyebutnya — bukan bukti bahwa setiap
> aturan bisnisnya sudah dipenuhi. Untuk kepastian per-aturan, `verify-ui.py`
> (48/48) dan uji integrasi adalah sumber yang lebih dapat dipercaya.
