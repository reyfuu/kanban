# 📊 Progress Implementasi SIGAP

> Status per **28 Agustus 2026** · Commit `bf60ff9`

---

## Ringkasan Cepat

| Area | Progress |
|---|---|
| Infrastruktur & Fondasi | ✅ ~100% |
| Database Schema | ✅ ~100% (28 model) |
| Modul B — Access Review | 🟡 ~60% |
| Modul A — Evidence Vault | 🔴 ~2% |
| Modul C — Policy Hub | 🔴 ~0% |
| Cross-cutting (FR-X) | 🟡 ~45% |
| **Keseluruhan (dari total FRD)** | **~28–32%** |

---

## Breakdown per Area

### ✅ Fondasi (100%)

- NestJS 11 API skeleton + modul shared (auth, audit, authz, redis, prisma)
- Next.js 15 web skeleton + layout berautentikasi
- Prisma schema 28 model, 2 migrasi
- Docker Compose infra (Postgres, Redis, Minio)
- CI gerbang mutu: lint, typecheck, 82 tes, `verify:docs`
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

### 🔴 Modul A — Evidence Vault (18 FR) · ~2%

Seluruh 18 FR-A **belum diimplementasi**. Hanya module shell (`evidence.module.ts`) yang ada.

| Status | Jumlah |
|---|---|
| ✅ Selesai | 0 |
| ⚠️ Parsial | 0 |
| ❌ Belum | 18 |

---

### 🔴 Modul C — Policy Hub (22 FR) · ~0%

Seluruh 22 FR-C **belum diimplementasi**. Hanya module shell (`policy.module.ts`) yang ada.

---

## Perhitungan Total

| Modul | FR total | FR selesai/parsial | Bobot |
|---|---|---|---|
| FR-X (cross-cutting) | 18 | ~8 | 22% scope |
| Modul B (Access Review) | 25 | ~15 | 30% scope |
| Modul A (Evidence Vault) | 18 | ~0 | 22% scope |
| Modul C (Policy Hub) | 22 | ~0 | 26% scope |
| **Total** | **83** | **~23** | |

### 🎯 Estimasi Overall: **~28–32%** dari total FRD

> Kalau hanya menghitung **Modul B yang jadi target demo**, progressnya jauh lebih tinggi: **~57–60%**.

---

## Catatan Penting

> [!IMPORTANT]
> Fondasi dan infrastruktur sangat solid. 82 tes lulus, audit chain diverifikasi, kontrol kritis K-1 s.d. K-9 teruji adversarial. Yang belum adalah **Modul A (Evidence Vault) dan C (Policy Hub)** yang sama sekali nol implementasi.

> [!WARNING]
> Beberapa item "jalan" masih parsial: AD real belum ada (pakai identity provider demo), notifikasi belum ada, laporan belum ada. Kalau scope demo = Modul B end-to-end, maka sudah **demo-ready**.

