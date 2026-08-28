# 📊 Progress Implementasi SIGAP

> Status per **28 Agustus 2026** · Commit `d544157`

---

## Ringkasan Cepat

| Area | Progress |
|---|---|
| Infrastruktur & Fondasi | ✅ ~100% |
| Database Schema | ✅ ~100% (58 model, 13 migrasi) |
| Modul A — Evidence Vault | ✅ 18/18 FR |
| Modul B — Access Review | ✅ 25/25 FR |
| Modul C — Policy Hub | ✅ 22/22 FR |
| Cross-cutting (FR-X) | 🟡 15/18 FR |
| **Keseluruhan (dari total FRD)** | **82/85 FR** |

---

## Cara angka ini dihitung

Setiap FR dihitung "terbangun" bila ada kode atau skema yang merujuk nomornya,
diperiksa silang dengan berkas uji dan dibaca kembali terhadap teks FRD untuk
requirement yang rujukannya paling tipis.

**Batasnya perlu dinyatakan:** rujukan di kode membuktikan requirement itu
dikerjakan, bukan bahwa setiap aturan bisnisnya dipenuhi. Untuk kepastian
per-aturan, sumber yang lebih dapat dipercaya adalah 292 tes (28 berkas, 14 di
antaranya uji integrasi terhadap PostgreSQL sungguhan), `verify-ui.py` (48/48 di
Chrome), dan `check-typography.py`.

Perintah yang menghasilkan angkanya:

```bash
for m in A B C X; do
  for fr in $(grep -o "^#### FR-$m-[0-9]*" docs/03-FRD.md | sed 's/#### //' | sort -u); do
    grep -rq "$fr" --include="*.ts" --include="*.prisma" apps packages || echo "kurang: $fr"
  done
done
```

---

## Breakdown per Area

### ✅ Fondasi

- NestJS 11 API + modul shared (auth, audit, authz, notification, llm-gateway, prisma)
- Next.js 15 web + layout berautentikasi
- Prisma schema 58 model, 13 migrasi SQL tulis tangan
- Docker Compose (PostgreSQL 16 + pgvector/pg_trgm, Redis 7, MinIO)
- Runtime **Bun 1.3** — proses API ~148MB (dari ~712MB dengan tsc)
- CI: lint, typecheck, 292 tes, `verify:docs`

---

### ✅ Modul A — Evidence Vault (18/18 FR)

| FR | Cakupan |
|---|---|
| FR-A-001..003 | Pustaka kontrol, framework, pemetaan cakupan |
| FR-A-004..005 | Penugasan dan siklus hidupnya |
| FR-A-006..009 | Permintaan bukti (PBC), daftar tugas PIC, **pengingat + eskalasi (FR-A-008)** |
| FR-A-010..014 | Bukti sebagai entitas mandiri, versi + integritas (K-8), **penggunaan ulang + gerbang periode (FR-A-012)** |
| FR-A-015 | Retensi, penahanan hukum, antrean penghapusan |
| FR-A-016..017 | Temuan dan tindak lanjut |
| FR-A-018 | Portal auditor eksternal |

**Menyusul:** object-lock penyimpanan yang membuat K-8 aturan 3 bersifat fisik,
bukan sekadar ditegakkan aplikasi.

---

### ✅ Modul B — Access Review (25/25 FR)

Seluruh FR-B-001 s.d. FR-B-025 terbangun: registri aplikasi, unggah CSV +
snapshot, pemetaan akun, deteksi anomali dan SoD (`DetectionService`,
`SodService`), penyusunan + siklus hidup kampanye, keputusan reviewer dengan
K-2/K-3/K-4, keputusan massal, sign-off K-9, tiket pencabutan K-1 beserta
verifikasi, dan paket bukti kampanye yang menaut otomatis ke Modul A.

> [!NOTE]
> Versi laporan sebelumnya menyebut Modul B "~57%". Itu keliru — seluruh 25 FR
> sudah dirujuk kode sebelum sesi ini dimulai. Yang belum adalah **konektor
> otomatis (FR-B-003)** dalam arti implementasi konektor per-aplikasi;
> kerangkanya ada dan jalur unggahan bertemplat (ADR-05) berfungsi penuh.

---

### ✅ Modul C — Policy Hub (22/22 FR)

| FR | Cakupan |
|---|---|
| FR-C-001..008 | Jenis dokumen, taksonomi, siklus hidup, pengesahan berjenjang, versi, jendela berlaku, tinjauan berkala |
| FR-C-009..012 | Pencarian hibrida, penyaringan hak akses di dalam DB, penyaring + jumlah, hasil kosong |
| **FR-C-013** | **Jawaban dari dokumen, dengan rujukan wajib terverifikasi** |
| **FR-C-014..017** | **Gerbang klasifikasi, redaksi, pencatatan gerbang, pemutus layanan** |
| **FR-C-018** | **Kemandirian penyedia lewat antarmuka `LlmProvider`** |
| FR-C-019..022 | Kampanye attestation, pencatatan pernyataan, pemantauan, penautan ke kontrol |

**LLM Gateway (ADR-03)** kini terbangun sebagai satu-satunya jalur keluar:
pemutus → gerbang klasifikasi → redaksi → catat sebelum kirim → kirim →
verifikasi rujukan → catat tanggapan.

> [!IMPORTANT]
> Gerbangnya **bawaan NONAKTIF** dan penyedianya `UnconfiguredLlmProvider`.
> ADR-03 mensyaratkan tujuh prasyarat (G1–G7: endpoint regional, perjanjian
> tanpa retensi, kredensial di penyimpanan rahasia, rotasi 180 hari, daftar izin
> proxy, batas anggaran, jadwal tinjauan) diverifikasi Divisi Kepatuhan sebelum
> diaktifkan. Mengaktifkannya adalah keputusan Kepatuhan, bukan keputusan teknis.

---

### 🟡 FR-X — Cross-cutting (15/18 FR)

**Terbangun:** FR-X-001..011, FR-X-013, FR-X-014, FR-X-017, FR-X-018.
Termasuk **mesin notifikasi + matriks 28 kode NT (FR-X-010/011)** yang dibangun
di sesi ini.

**Belum (3):**

| FR | Isi | Catatan |
|---|---|---|
| FR-X-012 | Pencarian global lintas modul | Pencarian per-modul sudah ada; yang kurang satu kotak pencarian lintas Modul A/B/C |
| FR-X-015 | Pembuatan laporan asinkron | Butuh antrean BullMQ pada worker (ADR-08) |
| FR-X-016 | Daftar 14 laporan standar | Bergantung pada FR-X-015 |

Ketiganya satu blok yang koheren: laporan asinkron dan daftar laporan adalah
pasangan, dan pencarian global memerlukan indeks lintas modul yang belum ada.

---

## Perhitungan Total

| Modul | FR total | FR terbangun |
|---|---|---|
| FR-X (cross-cutting) | 18 | 15 |
| Modul B (Access Review) | 25 | 25 |
| Modul A (Evidence Vault) | 18 | 18 |
| Modul C (Policy Hub) | 22 | 22 |
| **Total** | **85** | **82** |

### 🎯 Estimasi Overall: **82/85 FR (~96%)**

---

## Verifikasi yang tersedia

| Perintah | Yang diperiksa | Hasil terakhir |
|---|---|---|
| `bun run test` | 292 tes, 28 berkas (14 uji integrasi ke PostgreSQL) | LULUS |
| `bun run lint` | Batas modul ADR-01, larangan egress ADR-03, token warna | LULUS |
| `bun run typecheck` | Tiga paket | LULUS |
| `bun run verify:docs` | Keterlacakan ID lintas dokumen | LULUS |
| `python3 scripts/verify-ui.py` | 48 pemeriksaan di Chrome sungguhan | 48/48 |
| `python3 scripts/check-typography.py` | Ukuran font efektif pada 1366×768 | 0 pelanggaran |
| `python3 scripts/check-sidebar-scroll.py` | Gulir sidebar di lima ukuran layar | OK |

---

## Catatan Penting

> [!IMPORTANT]
> Ketiga modul produk (A, B, C) lengkap: 65 dari 65 FR. Sisa pekerjaan
> seluruhnya di lapisan lintas-modul (FR-X-012/015/016) dan pada dua hal yang
> memang bergantung pihak lain: aktivasi gerbang LLM menunggu verifikasi G1–G7
> oleh Kepatuhan, dan autentikasi masih memakai identity provider demo alih-alih
> AD/LDAP sungguhan.

> [!WARNING]
> Beberapa hal yang "terbangun" masih menunggu infrastruktur agar benar-benar
> berjalan di produksi: **(1)** pengiriman surel notifikasi belum ada — baris
> disimpan berstatus `ANTRE` dan menunggu pengirim SMTP; **(2)** penjadwal harian
> untuk `EscalationService.runDailyChase` dan verifikasi pencabutan belum
> dipasang di worker; **(3)** object-lock penyimpanan untuk K-8 aturan 3;
> **(4)** konektor akses per-aplikasi (FR-B-003).
