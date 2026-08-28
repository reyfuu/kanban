# SIGAP — Dokumentasi Produk
## Sistem Integrasi Governance, Akses, dan Prosedur
### PT Trimegah Sekuritas Indonesia Tbk

Platform tata kelola internal untuk Trimegah Sekuritas, terdiri atas tiga modul yang berbagi satu penyimpanan bukti bersama:

| Modul | Nama | Menjawab pertanyaan |
|---|---|---|
| **A** | **Evidence Vault** | *"Tunjukkan buktinya."* — manajemen bukti untuk audit internal, audit eksternal, pemeriksaan regulator, dan self-assessment |
| **B** | **Access Review** | *"Siapa saja yang punya akses, dan siapa yang menyetujuinya?"* — kampanye sertifikasi hak akses lintas aplikasi |
| **C** | **Policy Hub** | *"Mana aturannya, dan apakah orang Anda tahu?"* — siklus hidup, pencarian, dan attestation SOP serta kebijakan internal |

> **Nilai utama produk bukan pada ketiga modul berdiri sendiri, melainkan pada keterhubungannya.** Hasil kampanye review akses otomatis menjadi bukti kepatuhan untuk kontrol audit; SOP menjadi *control narrative* yang dirujuk kertas kerja auditor; satu bukti yang dikumpulkan sekali dapat dipetakan ke banyak kontrol dan banyak framework.

---

## Daftar Dokumen

| # | Dokumen | Isi | Audiens utama |
|---|---|---|---|
| 01 | [BRD — Business Requirements](01-BRD.md) | Business case, pemicu regulasi OJK/ISO, biaya kondisi saat ini, sasaran & KPI, ruang lingkup, risiko, roadmap 3 fase | Direksi, Komite Audit, Kepatuhan |
| 02 | [PRD — Product Requirements](02-PRD.md) | Visi produk, analisis pembanding, 8 persona, 15 epic, 41 user story dengan kriteria penerimaan, MoSCoW, metrik | Product Owner, Tim Pengembang |
| 03 | [FRD — Functional Requirements](03-FRD.md) | 85 requirement fungsional bernomor, 7 state machine, matriks hak akses, 28 jenis notifikasi, 14 laporan standar | Pengembang, QA, Business Analyst |
| 04 | [TRD — Technical Requirements](04-TRD.md) | Arsitektur, 8 keputusan arsitektur (ADR), model data & ERD, keamanan & model ancaman, NFR, sizing, penempatan | Arsitek, DevOps, DBA, IT Security |
| 05 | [UI/UX Flow](05-UIUX-FLOW.md) | Peta situs, 4 alur pengguna utama, 16 wireframe naratif, keadaan antarmuka, aksesibilitas | Designer, Frontend Developer |
| 06 | [DESIGN — Design System](06-DESIGN.md) | Token desain, semantik warna lintas modul, inventaris komponen, ikonografi, microcopy Bahasa Indonesia | Designer, Frontend Developer |
| 07 | [API Contract](07-API-CONTRACT.md) | Konvensi REST, autentikasi, 192 titik akhir dengan contoh muatan konkret, kerangka OpenAPI 3.1 | Pengembang Backend & Frontend, Integrator |
| 08 | [Agent Spec](08-AGENT-SPEC.md) | 6 agent AI, pola Usulan Agent, inventaris tool baca-saja, matriks rute model, model data & API tambahan | AI Engineer, Arsitek, Kepatuhan |
| 09 | [Guardrails](09-GUARDRAILS.md) | 33 guardrail dalam 8 lapis, 14 mode kegagalan, vektor penyisipan instruksi, penanganan insiden | AI Engineer, IT Security, Kepatuhan |
| 10 | [Test Plan](10-TEST-PLAN.md) | Piramida uji, 10 kontrol kritis, uji keamanan & penetrasi, 20 dimensi eval AI, 36 kasus uji guardrail, kinerja, UAT | QA Lead, Tim Pengembang, SKAI |
| 11 | [Alur Sistem](11-ALUR-SISTEM.md) | Perjalanan data end-to-end: asal pengguna dan data akses, alur tiap modul, titik temu ketiganya, posisi agent AI, tabel rujukan cepat | Seluruh audiens |
| 12 | [Panduan Sederhana](12-PANDUAN-SEDERHANA.md) | Penjelasan tanpa istilah teknis: SIGAP itu apa, 13 peran dan tugasnya, panduan langkah per peran, tiket pencabutan dijelaskan pelan-pelan | **Titik masuk bagi pembaca baru** — pengguna akhir, calon pengguna, orientasi tim |

### Urutan membaca yang disarankan

**Bila ini kali pertama Anda membaca:** mulai dari `12-PANDUAN-SEDERHANA`, yang menjelaskan sistem ini tanpa istilah teknis, lengkap dengan panduan langkah per peran. Setelah itu `11-ALUR-SISTEM` untuk melihat perjalanan datanya secara utuh. Barulah urutan sesuai peran di bawah menjadi mudah diikuti.

**Untuk pengguna akhir dan orientasi tim baru:** cukup `12-PANDUAN-SEDERHANA`. Bagian 6 memuat panduan langkah untuk tiap peran.

**Untuk pengambil keputusan (Direksi, Komite Audit):** baca `01-BRD` seluruhnya. Cukup untuk menilai apakah investasi ini layak.

**Untuk Kepatuhan & SKAI:** `01-BRD` → `02-PRD` (persona & user story) → `03-FRD` (aturan bisnis dan matriks hak akses).

**Untuk tim pengembang:** `02-PRD` (memahami untuk siapa) → `03-FRD` (apa yang harus dibangun) → `04-TRD` (bagaimana membangunnya) → `07-API-CONTRACT` → `05-UIUX-FLOW` → `06-DESIGN`. `11-ALUR-SISTEM` dibaca lebih dahulu bila belum memahami gambaran besarnya.

**Untuk AI Engineer:** `08-AGENT-SPEC` → `09-GUARDRAILS` → `10-TEST-PLAN §5`. Ketiganya dibaca berurutan; guardrail tidak dapat dipahami tanpa memahami batas wewenang agent lebih dulu.

**Untuk QA Lead:** `03-FRD` (sumber kasus uji) → `10-TEST-PLAN`. Perhatikan §3.2 — sepuluh kontrol kritis yang tidak boleh dikesampingkan.

**Untuk vendor yang mengikuti tender:** seluruh dokumen. `03-FRD`, `07-API-CONTRACT`, dan `10-TEST-PLAN §11` menjadi dasar ruang lingkup dan kriteria serah terima yang mengikat.

---

## Keputusan yang Sudah Ditetapkan

| Aspek | Keputusan | Rujukan |
|---|---|---|
| Deployment | On-premise, pusat data sendiri (DC + DRC) | [TRD §6.3](04-TRD.md) |
| Tumpukan teknologi | Node.js + NestJS, PostgreSQL 16, Next.js, MinIO, Redis | [TRD §1.2](04-TRD.md) |
| Arsitektur | Modular monolith, bukan microservices | [TRD ADR-01](04-TRD.md) |
| Identitas & autentikasi | Active Directory / LDAP on-premise | [TRD ADR-06](04-TRD.md) |
| Pencarian dokumen | Hibrida — `tsvector` + `pgvector` di dalam PostgreSQL | [TRD ADR-02](04-TRD.md) |
| Jawaban otomatis | RAG dengan LLM eksternal, dibatasi gerbang klasifikasi | [TRD ADR-03](04-TRD.md) |
| Pembentukan vektor | **Model lokal di dalam pusat data** | [TRD ADR-03](04-TRD.md) |
| Integrasi data akses | Campuran — konektor otomatis + unggahan CSV bertemplat | [TRD ADR-05](04-TRD.md) |
| Skala | 1 badan hukum, 300–1.000 karyawan, 20–50 aplikasi | [BRD §7 ASM-01](01-BRD.md) |
| Bahasa dokumen | Bahasa Indonesia, istilah teknis dalam bahasa Inggris | — |
| Otonomi agent AI | **Hanya menyarankan.** Tidak ada agent yang menulis ke data produksi | [AGENT §1.1](08-AGENT-SPEC.md) |
| Rute model agent | Hibrida per klasifikasi. AG-2, AG-3, AG-5 wajib model lokal | [AGENT §2.3](08-AGENT-SPEC.md) |
| Hak akses agent | Mewarisi hak akses pemohon; tanpa akun layanan istimewa | [GR-0.2](09-GUARDRAILS.md) |
| Penyedia LLM eksternal | **Google Gemini**, hanya untuk AG-1 dan AG-6, dengan 7 syarat kepatuhan G1–G7 | [ADR-03](04-TRD.md) |
| Identitas visual | Merek Trimegah pada chrome; warna semantik utuh di area data | [DESIGN §2.0](06-DESIGN.md) |

### Ketegangan yang dicatat secara terbuka

Penggunaan **layanan LLM eksternal** berbenturan dengan prinsip **deployment on-premise**: isi dokumen keluar dari pusat data perusahaan. Keputusan ini diambil secara sadar oleh pemilik produk, dan mitigasinya dirancang eksplisit, bukan diabaikan:

- Gerbang klasifikasi — hanya dokumen Publik dan Internal yang boleh keluar ([FRD FR-C-014](03-FRD.md))
- Redaksi wajib atas pola data pribadi; kegagalan redaksi membatalkan pengiriman ([FRD FR-C-015](03-FRD.md))
- Egress terkendali melalui proxy dengan daftar izin; peladen aplikasi tidak punya rute langsung ke internet ([TRD §5.1](04-TRD.md))
- Pencatatan penuh muatan sebelum dan sesudah redaksi selama 24 bulan ([FRD FR-C-016](03-FRD.md))
- Pemutus layanan yang berlaku seketika tanpa penempatan ulang ([FRD FR-C-017](03-FRD.md))
- Antarmuka `LlmProvider` sehingga perpindahan ke model lokal tidak menuntut perubahan kode ([TRD ADR-03](04-TRD.md))
- Pembentukan vektor tetap lokal, karena pengindeksan memproses **seluruh** dokumen termasuk yang rahasia

---

## Glosarium

| Istilah | Arti dalam SIGAP |
|---|---|
| **Anomali akses** | Kondisi tidak wajar pada data akses: akun milik karyawan yang sudah berhenti, akun tanpa pemilik, akun tidak aktif, dan sejenisnya. Kode AN-01 s.d. AN-08 |
| **Attestation** | Pernyataan formal karyawan bahwa ia telah membaca dokumen tertentu, tercatat lengkap dengan identitas, waktu, dan versi dokumen |
| **Bukti (evidence)** | Berkas atau data yang membuktikan suatu kontrol dijalankan. Entitas mandiri yang dapat ditautkan ke banyak permintaan, kontrol, dan penugasan |
| **Chain of custody** | Rantai kepemilikan bukti — siapa mengunggah, kapan, siapa menelaah, apa keputusannya, dalam urutan yang tidak dapat diubah |
| **Framework** | Kerangka ketentuan yang harus dipatuhi: POJK, ISO/IEC 27001, COBIT, atau kerangka kebijakan internal |
| **Gerbang LLM** | Modul tunggal yang menjadi satu-satunya jalur keluar menuju penyedia layanan pemroses bahasa eksternal, menegakkan klasifikasi dan redaksi |
| **Hak akses (entitlement)** | Peran, grup, izin, atau profil yang dimiliki seorang pengguna dalam sebuah aplikasi |
| **Item review** | Satu kombinasi identitas dan hak akses yang harus diputuskan seorang reviewer dalam sebuah kampanye |
| **Kampanye** | Siklus review hak akses dengan cakupan, reviewer, jadwal, dan tenggat tertentu |
| **Kontrol** | Prosedur pengendalian internal yang dirancang untuk mencegah atau mendeteksi risiko tertentu |
| **Legal hold** | Penahanan penghapusan bukti karena kebutuhan hukum, membatalkan seluruh aturan retensi sampai dicabut |
| **Paket bukti kampanye** | Berkas tunggal berisi seluruh hasil kampanye review — cakupan, keputusan, alasan, sign-off, dan status pencabutan. Otomatis menjadi bukti pada Modul A |
| **PBC (*provided by client*)** | Daftar permintaan bukti dari auditor. Dalam SIGAP disebut **permintaan bukti** |
| **Pemisahan tugas (SoD)** | Prinsip bahwa kombinasi kewenangan tertentu tidak boleh dipegang satu orang. Kode SOD-01 s.d. SOD-06 |
| **Penugasan (engagement)** | Satu kegiatan audit, assessment, pemeriksaan regulator, atau self-assessment |
| **Pustaka kontrol** | Daftar terpusat seluruh kontrol perusahaan, dipetakan ke banyak framework sekaligus |
| **RAG** | *Retrieval-Augmented Generation* — jawaban yang disusun dari potongan dokumen internal yang ditemukan lebih dahulu, disertai rujukan |
| **Sidik jari (hash)** | Nilai kriptografis SHA-256 atas isi berkas, dipakai untuk membuktikan berkas tidak berubah |
| **Sign-off** | Penandatanganan elektronik hasil review oleh pihak yang bertanggung jawab, disertai autentikasi ulang |
| **Snapshot** | Potret utuh seluruh identitas dan hak akses sebuah aplikasi pada satu waktu tertentu. Tidak dapat diubah |
| **Tiket pencabutan** | Perintah kerja yang lahir dari keputusan "Cabut", dipantau sampai terbukti tertutup melalui snapshot berikutnya |
| **Verifikasi pencabutan** | Pembuktian oleh sistem bahwa hak akses benar-benar hilang, berdasarkan snapshot — bukan berdasarkan klaim pelaksana |
| **Agent** | Komponen AI yang menjalankan pekerjaan berlangkah banyak dengan tool baca-saja. Dalam SIGAP, agent hanya menghasilkan usulan; tidak pernah menulis data |
| **Usulan Agent** | Keluaran agent yang menunggu telaah manusia. Menjadi data hanya setelah diterima pihak berwenang, dan tercatat atas nama penelaah |
| **Guardrail** | Kontrol perilaku agent yang ditegakkan di dalam kode, di luar model. Kontrol yang hanya ada di dalam prompt tidak dihitung sebagai guardrail |
| **Pembumian (*grounding*)** | Keharusan setiap pernyataan agent dapat dipetakan ke potongan sumber yang benar-benar dimuat pada eksekusi itu |
| **Penyisipan instruksi** | Serangan berupa penanaman perintah di dalam data — isi dokumen, kolom CSV, nama akun — agar agent menyimpang dari tugasnya |
| **Dataset acuan** | Kumpulan kasus beserta jawaban benar yang telah divalidasi manusia berwenang, dipakai mengukur mutu agent |
| **Geseran (*drift*)** | Penurunan mutu agent tanpa perubahan kode, akibat perubahan model, data, atau pola pemakaian |

---

## Sistem Penomoran

Seluruh dokumen memakai ID yang stabil dan tidak digunakan ulang.

| Awalan | Arti | Dokumen |
|---|---|---|
| `OBJ-xx` | Sasaran bisnis | BRD §4 |
| `REG-xx` | Pemicu regulasi | BRD §2.3 |
| `BR-<M>-xx` | Kebutuhan bisnis per modul | BRD §8 |
| `ASM-xx` | Asumsi | BRD §7 |
| `DEP-xx` | Ketergantungan eksternal | BRD §6.3 |
| `RSK-xx` | Risiko bisnis | BRD §10 |
| `PER-xx` | Persona | PRD §3 |
| `EP-xx` | Epic | PRD §4 |
| `US-<M>-xx` | User story | PRD §4 |
| `FR-<M>-xxx` | Requirement fungsional | FRD |
| `NFR-xx` | Requirement non-fungsional | FRD §8, TRD §6 |
| `NT-xx` | Jenis notifikasi | FRD §2.4 |
| `RPT-xx` | Laporan standar | FRD §2.7 |
| `AN-xx` | Jenis anomali akses | FRD §4.3 |
| `RA-xx` | Aturan penugasan reviewer | FRD §4.4 |
| `SOD-xx` | Aturan pemisahan tugas | FRD §4.7 |
| `ADR-xx` | Keputusan arsitektur | TRD §2 |
| `U-x` | Prinsip UX | UX §1 |
| `L-xx` | Layar | UX §4 |
| `AG-x` | Agent AI | AGENT §3 |
| `GR-x.y` | Guardrail, `x` = lapis | GUARDRAILS §2–9 |
| `F-xx` | Mode kegagalan agent | GUARDRAILS §10 |
| `EV-xx` | Dimensi evaluasi AI | TEST §5.2 |
| `DS-xx` | Dataset acuan eval | TEST §5.1 |
| `TC-<kel>-xx` | Kasus uji; `kel` = FN, SEC, PERF, ACC, E2E, AI | TEST |
| `UAT-xx` | Skenario uji terima | TEST §9 |
| `K-x` | Kontrol kritis yang tidak boleh dikesampingkan | TEST §3.2 |

`<M>` diisi `X` (lintas modul), `A`, `B`, atau `C`.

---

## Matriks Keterlacakan

Rantai penuh: **sasaran bisnis → user story → requirement fungsional → titik akhir API → layar**. Matriks ini menjadi dasar verifikasi kelengkapan dan penyusunan rencana pengujian.

### Modul C — Policy Hub (Fase 1)

| Sasaran | User story | Requirement | API | Layar |
|---|---|---|---|---|
| OBJ-09 | US-C-01 | FR-C-001, FR-C-003 | `POST /documents` | L-03 |
| OBJ-09 | US-C-02 | FR-C-004, FR-C-005 | `POST /document-versions/{id}/approve` | L-03 |
| OBJ-09 | US-C-03 | FR-C-006, FR-C-007 | `GET /documents/{id}/effective-on`, `GET /documents/{id}/compare` | L-03 |
| OBJ-09 | US-C-04 | FR-C-008 | `GET /documents?review_status=TERLAMBAT` | L-15 |
| OBJ-09 | US-C-05 | FR-C-004 | `POST /documents/{id}/retire` | L-03 |
| OBJ-08 | US-C-06 | FR-C-009, FR-C-011, FR-C-012 | `GET /search` | L-02 |
| OBJ-11 | US-C-07 | FR-C-010, FR-X-018 | `GET /search` | L-02 |
| OBJ-08 | US-C-08 | FR-C-013 | `POST /ask` | L-02 |
| OBJ-11 | US-C-09 | FR-C-014 s.d. FR-C-018 | `/llm-gateway/*` | L-16 |
| OBJ-10 | US-C-10 | FR-C-019 s.d. FR-C-021 | `/attestation-campaigns`, `POST /attestation-tasks/{id}/attest` | L-03 |

### Modul A — Evidence Vault (Fase 2)

| Sasaran | User story | Requirement | API | Layar |
|---|---|---|---|---|
| OBJ-01 | US-A-01 | FR-A-001 | `POST /controls` | — |
| OBJ-02 | US-A-02 | FR-A-002, FR-A-003 | `POST /controls/{id}/mappings`, `GET /frameworks/{id}/coverage` | — |
| OBJ-01 | US-A-03 | FR-A-004, FR-A-005 | `POST /engagements`, `POST /engagements/{id}/transition` | L-04 |
| OBJ-01, OBJ-03 | US-A-04 | FR-A-006, FR-A-008 | `POST /engagements/{id}/request-items` | L-05 |
| OBJ-01 | US-A-05 | FR-A-007, FR-A-009 | `GET /my/request-items`, `POST /request-items/{id}/fulfil` | L-06 |
| OBJ-03 | US-A-06 | FR-A-011, FR-X-013 | `GET /evidence/{id}/attestation`, `POST /uploads/presign` | L-07 |
| OBJ-02 | US-A-07 | FR-A-010, FR-A-012 | `POST /evidence/{id}/links` | L-06, L-07 |
| OBJ-01 | US-A-08 | FR-A-013 | `POST /request-items/{id}/review` | L-05 |
| REG-11 | US-A-09 | FR-A-015 | `POST /engagements/{id}/legal-hold` | — |
| OBJ-12 | US-A-10 | FR-A-016 | `POST /engagements/{id}/findings` | L-04 |
| OBJ-12 | US-A-11 | FR-A-017 | `POST /remediations/{id}/verify` | L-04 |
| OBJ-01 | US-A-12 | FR-A-018 | `/portal/*` | L-08 |

### Modul B — Access Review (Fase 3)

| Sasaran | User story | Requirement | API | Layar |
|---|---|---|---|---|
| REG-03 | US-B-01 | FR-B-001, FR-B-002 | `POST /applications` | L-13 |
| OBJ-04 | US-B-02 | FR-B-003, FR-B-005 | `/connectors`, `POST /connectors/{id}/run` | L-13 |
| OBJ-04 | US-B-03 | FR-B-004, FR-B-005, FR-B-006 | `POST /snapshots/upload/validate`, `POST /snapshots/upload`, `GET /snapshots/compare` | L-14 |
| OBJ-06 | US-B-04 | FR-B-006, FR-B-007 | `GET /access-anomalies?type=AN-01` | — |
| OBJ-06 | US-B-05 | FR-B-006, FR-B-007 | `GET /access-anomalies` | — |
| OBJ-04 | US-B-06 | FR-B-008 s.d. FR-B-010 | `POST /campaigns`, `POST /campaigns/{id}/preview` | L-09 |
| OBJ-07 | US-B-07 | FR-B-011 s.d. FR-B-013 | `GET /my/review-items`, `POST /review-items/{id}/decision` | L-10 |
| OBJ-07 | US-B-08 | FR-B-015 | `POST /campaigns/{id}/signoff` | L-11 |
| OBJ-07 | US-B-09 | FR-B-014, FR-B-016 | `GET /campaigns/{id}/progress` | L-09 |
| OBJ-05 | US-B-10 | FR-B-018, FR-B-019 | `/revocation-tickets` | L-12 |
| OBJ-05 | US-B-11 | FR-B-020, FR-B-021 | `POST /revocation-tickets/{id}/verify-now` | L-12 |
| OBJ-02, OBJ-07 | US-B-12 | FR-B-022, FR-B-023 | `POST /campaigns/{id}/evidence-package` | L-09 |
| REG-04 | US-B-13 | FR-B-024, FR-B-025 | `/sod-rules`, `POST /sod-rules/{id}/simulate` | — |

### Lintas modul (Fase 1)

| Sasaran | User story | Requirement | API | Layar |
|---|---|---|---|---|
| — | US-X-01 | FR-X-001, FR-X-002, FR-X-004 | `/auth/*` | — |
| REG-04 | US-X-02 | FR-X-005, FR-X-006 | `POST /users/{id}/roles` | — |
| REG-01 | US-X-03 | FR-X-008, FR-X-009 | `GET /audit-logs`, `POST /audit-logs/verify-chain` | — |
| — | US-X-04 | FR-X-007 | `POST /delegations` | — |
| OBJ-12 | US-X-05 | FR-X-016 | `GET /dashboard/executive` | L-15 |
| OBJ-12 | US-X-06 | FR-X-015 | `POST /reports/{code}/generate` | — |

### Agent AI

| Agent | Requirement yang didukung | Rute | Guardrail khusus | Eval | Fase |
|---|---|---|---|---|---|
| AG-1 Policy Q&A | FR-C-013 s.d. FR-C-017 | Eksternal | GR-2.2, GR-4.2 | EV-03 s.d. EV-06 | 1 |
| AG-4 Evidence Matcher | FR-A-012, OBJ-02 | Lokal* | GR-4.3 | EV-11, EV-12 | 2 |
| AG-6 Control Mapper | FR-A-003 | Eksternal | GR-4.2, GR-4.3 | EV-15, EV-16 | 2 |
| AG-5 Workpaper Drafter | FR-A-016 | Lokal | GR-4.2, GR-4.3, GR-5.3 | EV-13, EV-14 | 2 |
| AG-2 Entitlement Describer | FR-B-002 | Lokal | GR-4.3 | EV-08 | 3 |
| AG-3 Anomaly Triage | FR-B-007 | Lokal | GR-4.3 | EV-09, EV-10 | 3 |

\* Boleh eksternal hanya bila seluruh kandidat berklasifikasi Publik atau Internal.

### Requirement tanpa user story langsung

Requirement berikut bersifat infrastruktural dan tidak berasal dari satu user story tunggal, melainkan menopang seluruhnya: `FR-X-003` (autentikasi ulang), `FR-X-010`–`FR-X-011` (notifikasi), `FR-X-012` (pencarian global), `FR-X-013`–`FR-X-014` (berkas), `FR-X-017` (data induk), `FR-X-018` (klasifikasi), `FR-X-019`–`FR-X-020` (validasi umum), `FR-A-014` (bukti dibangkitkan sistem), `FR-B-017` (perlakuan akses istimewa), `FR-C-002` (taksonomi), `FR-C-022` (penautan dokumen ke kontrol).

---

## Referensi Produk Sejenis

Ditelaah sebagai pembanding kapabilitas dan sumber pola rancangan. Daftar lengkap beserta catatan analisis ada pada [BRD Lampiran A](01-BRD.md) dan [PRD §2](02-PRD.md).

**Manajemen bukti audit & GRC**
[AuditBoard](https://www.auditboard.com/) · [Hyperproof](https://hyperproof.io/) · [Workiva](https://www.workiva.com/) · [Gartner Peer Insights — Audit Management](https://www.gartner.com/reviews/market/audit-management-solutions) · [Fitur wajib alat manajemen bukti audit](https://www.floqast.com/blog/10-must-have-features-in-audit-evidence-management-tools)

**Sumber terbuka untuk studi model data**
[Probo](https://github.com/getprobo/probo) · [CISO Assistant](https://github.com/intuitem/ciso-assistant-community) · [Eramba](https://www.eramba.org/) · [SimpleRisk](https://www.simplerisk.com/)

**Review hak akses & tata kelola identitas**
[SailPoint](https://www.sailpoint.com/compare) · [Saviynt](https://saviynt.com/) · [Veza](https://veza.com/blog/user-access-review-software/) · [ConductorOne](https://www.conductorone.com/) · [Zluri — perbandingan alat IGA](https://www.zluri.com/eye-on-identity/iga-tools-comparison-compliance-access-reviews-veza-lumos-zluri) · [Microsoft Entra ID Governance Access Reviews](https://learn.microsoft.com/en-us/entra/id-governance/access-reviews-overview) · [Panduan pembeli UAR](https://www.balkan.id/buyers-guide/user-access-review-software)

**Manajemen kebijakan & pencarian dokumen**
[NAVEX PolicyTech](https://www.navex.com/en-us/platform/policy-procedure-management/) · [PowerDMS](https://www.powerdms.com/policy-learning-center/buyers-guide-policy-management-tools) · [ComplianceBridge](https://compliancebridge.com/) · [Glean](https://www.glean.com/) · [Guru](https://www.getguru.com/)

**Rujukan regulasi**
[POJK Manajemen Risiko TI](https://ojk.go.id/id/regulasi/Pages/POJK-tentang-Penerapan-Manajemen-Risiko-dalam-Penggunaan-Teknologi-Informasi-Oleh-Bank-Umum.aspx) · [SEOJK 29/SEOJK.03/2022 Ketahanan & Keamanan Siber](https://www.ojk.go.id/id/regulasi/Documents/Pages/Ketahanan-dan-Keamanan-Siber-Bagi-Bank-Umum/SEOJK%2029%20SEOJK.03%202022.pdf) · [Ringkasan ketentuan Perusahaan Efek](https://prolegal.id/update-peraturan-ojk-tentang-perusahaan-efek-apa-saja-poin-pentingnya/)

---

## Hal yang Harus Diverifikasi Sebelum Finalisasi

Dokumen ini disusun dengan asumsi yang dinyatakan terbuka. Sebelum dibawa ke pengambilan keputusan, hal berikut perlu divalidasi:

| # | Yang perlu diverifikasi | Pemilik | Rujukan |
|---|---|---|---|
| 1 | Nomor dan tahun ketentuan OJK terkini yang berlaku bagi Perusahaan Efek | Divisi Kepatuhan | [BRD §2.3](01-BRD.md) |
| 2 | Angka biaya kondisi saat ini melalui *time study* pada satu siklus audit dan satu siklus UAR | SKAI & IT Security | [BRD §3](01-BRD.md) |
| 3 | Masa retensi bukti yang mengikat menurut ketentuan sektor efek | Divisi Kepatuhan | [PRD §8 Q-03](02-PRD.md) |
| 4 | Penyedia layanan LLM yang disetujui beserta ketersediaan endpoint regional dan perjanjian tanpa retensi | Kepatuhan & TI | [PRD §8 Q-02](02-PRD.md) |
| 5 | Apakah sign-off elektronik memadai atau diperlukan tanda tangan digital bersertifikat | Kepatuhan & Hukum | [PRD §8 Q-04](02-PRD.md) |
| 6 | Ketersediaan integrasi langsung ke sistem HR | HRD & TI | [PRD §8 Q-01](02-PRD.md) |
| 7 | Daftar 5 aplikasi percontohan kampanye UAR | IT Security | [PRD §8 Q-05](02-PRD.md) |
| 8 | Pejabat yang berwenang menyetujui pengecualian konflik pemisahan tugas | Direksi | [PRD §8 Q-06](02-PRD.md) |
| 9 | Apakah portal auditor eksternal boleh diakses dari luar jaringan perusahaan | IT Security | [PRD §8 Q-07](02-PRD.md) |
| 10 | Estimasi biaya pengembangan dan pengadaan infrastruktur | Divisi TI | [BRD §9.3](01-BRD.md) |
| 11 | **Anggaran satu peladen GPU 48 GB yang belum tercakup sizing awal** — prasyarat AG-2, AG-3, AG-5 | Divisi TI | [AGENT QA-01](08-AGENT-SPEC.md) |
| 12 | Pilihan model lokal dan kelayakan lisensinya untuk pemakaian komersial internal | TI & Hukum | [AGENT QA-02](08-AGENT-SPEC.md) |
| 13 | Siapa yang berwenang mengaktifkan dan menonaktifkan tiap agent | Kepatuhan | [AGENT QA-03](08-AGENT-SPEC.md) |
| 14 | Apakah penanda asal draf AG-5 perlu muncul pada laporan audit final | SKAI & Kepatuhan | [AGENT QA-04](08-AGENT-SPEC.md) |
| 15 | Masa simpan catatan eksekusi agent | Kepatuhan | [AGENT QA-05](08-AGENT-SPEC.md) |
| 16 | Apakah anak usaha ikut memakai SIGAP — memengaruhi arsitektur secara mendasar. **Tidak lagi memblokir Fase 1:** rancangan mengikuti keputusan tertulis satu badan hukum ([TRD §10](04-TRD.md) butir 6). Konfirmasi Direksi tetap ditunggu, dan makin lama makin mahal untuk dibalik | Direksi & TI | [PRD Q-08](02-PRD.md), [BRD ASM-01](01-BRD.md) |
| 17 | Brand guideline Trimegah: nilai warna, tipografi, berkas logo, aturan zona aman | Tim Brand | [DESIGN §2.0](06-DESIGN.md) |
| 18 | Pemenuhan tujuh syarat kepatuhan Gemini G1–G7 sebelum AG-1 diaktifkan | Kepatuhan & TI | [ADR-03](04-TRD.md) |
| 19 | Ruang lingkup aplikasi awal: Trima+, back office, kustodian, atau fixed income | IT Security | [PRD Q-09](02-PRD.md) |

---

*Versi dokumentasi 1.0 · 27 Agustus 2026 · Klasifikasi: Internal*
