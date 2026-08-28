# HANDOFF — SIGAP

Status per **28 Agustus 2026**, commit `bf60ff9`. Untuk orang berikutnya yang melanjutkan, termasuk Anda sendiri beberapa minggu lagi.

---

## 1. Posisi saat ini

**Proyek:** SIGAP — Sistem Integrasi Governance, Akses, dan Prosedur, untuk PT Trimegah Sekuritas Indonesia Tbk.

**Tahap:** dokumentasi lengkap, fondasi lintas modul berjalan, dan **alur demo Modul B kini utuh dari ujung ke ujung, termasuk sumber datanya** — data akses masuk lewat unggahan bertemplat, reviewer memutuskan, menandatangani, tiket pencabutan terbentuk, dan tiket hanya tertutup oleh snapshot berikutnya yang membuktikan aksesnya hilang.

```
docs/          11 dokumen · sumber kebenaran · verify-docs LULUS
apps/api/      NestJS 11 — audit, autentikasi, otorisasi, step-up, Modul B
apps/web/      Next.js 15 — masuk, beranda, jejak audit, Kampanye, Penyusun
               Kampanye, Review Saya, Registri Aplikasi, Tiket
packages/db/   Prisma 6 — 2 migrasi, 42 tabel
.claude/       9 subagent + 6 skill
```

**Repo:** `/home/reyfuu/ai-assitant`, cabang `main`, tanpa remote.

### Yang bisa dijalankan hari ini

```bash
pnpm install && cp .env.example .env
pnpm infra:up && pnpm db:setup && pnpm db:generate && pnpm db:seed
pnpm dev:api    # 3001
pnpm dev:web    # 3000
```

Alur demonya ada di [README](README.md#alur-demo-modul-b). Ringkasnya: masuk sebagai
`dewi.lestari`, buka **Review Saya**, putuskan, tanda tangani; lalu masuk sebagai
`rina.kusuma` untuk melihat tiket yang terbentuk dan mencoba menutupnya secara manual.

**Dua hal yang perlu diketahui sebelum mendemokan.**

Pertama, alurnya **sekali jalan per benih**. Sign-off mengunci keputusan (K-9,
memang begitu maksudnya), jadi setelah didemokan sekali, layar `dewi.lestari`
akan tampil terkunci. Benihnya idempoten dan **tidak** mengulang kampanye yang
sudah ada, jadi untuk mengulang demo dari awal, buang basis datanya:

```bash
docker compose down -v && pnpm infra:up && pnpm db:setup && pnpm db:seed
```

Kedua, benihnya **peka tanggal**. Snapshot demo diberi tanggal 27 Agustus 2026,
dan FR-B-008 aturan 3 menolak peluncuran kampanye atas snapshot berumur lebih
dari 7 hari. Setelah awal September 2026, penyusun kampanye akan menolak seluruh
aplikasi demo dengan alasan yang benar.

Ini **tidak lagi buntu**: unggah data akses untuk aplikasi itu dan snapshot yang
dihasilkan bertanggal hari ini, sehingga penyusun kampanye langsung menerimanya
lagi. Caranya ada di [README](README.md#menutup-lingkaran-k-1-dengan-data-akses-sungguhan).
Memajukan `capturedAt` di `packages/db/seed/module-b.ts` tetap merupakan jalan
pintas yang sah bila yang diinginkan hanya benih yang segar.

---

## 2. Yang berubah pada sesi ini

**Pengambilan data akses lewat unggahan bertemplat — butir nomor satu daftar
"berikutnya" sebelumnya, sebagian.** Sampai sesi ini satu-satunya sumber data
akses adalah benih, sehingga K-1 berhenti pada "tiket menunggu snapshot
berikutnya" dan snapshot itu tidak pernah datang. Kini datang.

| Butir | Keadaan |
|---|---|
| FR-B-004 · unggahan berkas bertemplat | Jalan · templat per aplikasi, validasi, berkas baris bermasalah, konfirmasi penurunan baris |
| FR-B-005 · snapshot akses | Jalan · daftar per aplikasi, rincian, baris, perbandingan |
| FR-B-006 · pemetaan akun ke karyawan | Aturan 1 dan 4 · nomor induk → surel → akun direktori; sisanya Tanpa Pemilik |
| FR-B-003 · konektor otomatis | **Belum** · tetap skema saja |
| Lingkaran K-1 | **Tertutup** · snapshot yang diunggah memverifikasi tiket yang menunggu |

Delapan titik akhir baru, seluruhnya di `SnapshotController`. Tidak ada layar
baru — alurnya lewat API, dan itu disengaja: unggahan tanpa layar tetap menutup
lingkaran K-1 untuk demo, sedangkan layar tanpa unggahan tidak menutup apa pun.

```
templat → validasi (nol tulisan) → simpan (satu transaksi) → verifikasi K-1
```

Yang paling layak diperiksa ulang oleh orang berikutnya:

- **Validasi dan penyimpanan berbagi satu jalur.** `validate` menjalankan aturan
  baris, peringatan penurunan, dan kaskade pemetaan yang sama persis dengan yang
  dijalankan `commit`. Pratinjau yang dihitung kode berbeda adalah janji yang
  tidak ditepati sistem.
- **Snapshot lahir berstatus `SELESAI`, bukan `MEMPROSES`.** Barisnya mendarat di
  transaksi yang sama, jadi tidak ada jendela ketika snapshot ada tetapi barisnya
  belum. K-1 dan cakupan kampanye hanya membaca `SELESAI`, dan snapshot separuh
  jadi yang terbaca keduanya adalah persis "aksesnya sudah hilang" yang palsu.
- **Verifikasi K-1 berjalan di luar transaksi penyimpanan.** Snapshot adalah
  fakta; verifikasi adalah pembacaan atasnya. Kegagalan membaca tidak boleh
  membatalkan pengambilan data yang sudah benar.
- **Sidik jari isi diurutkan sebelum di-hash.** Ekspor ulang dengan urutan baris
  berbeda menghasilkan sidik jari yang sama — kalau tidak, setiap ekspor terlihat
  seperti perubahan dan sidik jarinya tidak menjawab pertanyaan apa pun.

Sisa daftar "berikutnya" sebelumnya tidak disentuh.

### Masih berlaku dari sesi-sesi sebelumnya

| Butir | Keadaan |
|---|---|
| Penyimpangan ADR-07 | **Diputuskan** — dokumennya diperbaiki, kodenya tetap. Lihat §3 |
| FR-X-003 autentikasi ulang | Jalan — `POST /auth/step-up`, token 5 menit di Redis, terikat sesi |
| Penyaringan cakupan di repositori | Jalan — dan sebuah **kebocoran nyata ditemukan serta ditutup**. Lihat §4 |
| Backend Modul B | Keputusan (K-2/K-3/K-4), sign-off (K-9), tiket & verifikasi (K-1) |
| Layar L-10 Review Saya + L-11 sign-off | Jalan |
| Layar Tiket Pencabutan | Jalan — kolom "Bukti" adalah K-1 yang terlihat |
| Data demo Modul B | 4 aplikasi, 8 hak akses, 13 item, satu konflik SoD nyata |
| Penyusun kampanye FR-B-008 s.d. FR-B-010 | Jalan — susun, pratinjau, luncurkan, perpanjang, batalkan |
| Penugasan reviewer FR-B-009 | RA-01, RA-02, RA-03, RA-05 jalan; RA-04 sengaja tidak |
| Layar L-09, daftar kampanye, registri aplikasi | Jalan |

Kontrol kritis diuji dengan **mencoba melanggarnya** terhadap tumpukan yang berjalan,
bukan dengan membaca kode. Rekamannya:

```
K-2  keputusan dihilangkan → 400 · nilai tak dikenal → 400 · tidak ada radio terpilih di HTML
K-3  Pertahankan pada hak istimewa tanpa alasan → 422 · "masih" → 422 · "aaaaaaaaaaaaaaa" → 422
K-4  massal memuat item istimewa → diterapkan 1, ditolak 1, dengan seluruh alasan pengecualian
K-9  sign-off tanpa X-Step-Up-Token → 401 · token palsu → 401 · ubah keputusan setelah tanda tangan → 409
K-1  minta TERVERIFIKASI_TERTUTUP → 400 (DTO menolaknya) · pelaksana klaim selesai + akses masih
     ada pada snapshot → GAGAL_DIVERIFIKASI · akses benar-benar hilang → tertutup, distempel snapshot
K-1  lewat unggahan: snapshot memuat hak aksesnya → GAGAL_DIVERIFIKASI · snapshot tanpa hak akses
     itu → TERVERIFIKASI_TERTUTUP dengan verified_by_snapshot_id terisi. Diikat sebagai tes.
K-7  rantai audit diverifikasi ulang setelah seluruh perubahan: 180 baris, is_valid = t, tanpa putus
```

Gerbang mutu: lint, typecheck, **82 tes**, `verify:docs` — keempatnya lulus.

---

## 3. Penyimpangan ADR-07: diputuskan

Handoff sebelumnya menyerahkan ini sebagai keputusan terbuka. **Keputusannya: kode benar, dokumennya yang salah.**

ADR-07 menuliskan partisi atas `snapshot_id`, sementara TRD §3.5 pada dokumen yang sama
menyebut partisi rentang **waktu**. Partisi rentang bulanan atas UUID tidak bermakna,
dan pertanyaan arsip selalu berbentuk rentang waktu. [ADR-07](docs/04-TRD.md) sudah
diperbaiki untuk menyebut `captured_at`, **dan** untuk menyatakan konsekuensinya
secara eksplisit alih-alih membiarkannya ditemukan sendiri:

`review_item.snapshot_line_id` dan `access_anomaly.snapshot_line_id` tidak punya kunci
asing, dan tidak akan pernah punya. Integritas referensialnya ada di
`ReviewItemRepository.assertSnapshotLineExists`, dipanggil pada jalur tulis. Ada tes
yang **memastikan basis data memang menerima** review_item yatim — bukan bug yang
diakui, melainkan konsekuensi yang dipatok: hari ketika seseorang berhasil menambahkan
kendala itu, tes tersebut gagal dan memberi tahu bahwa pemeriksaan di repositori sudah
tidak diperlukan, alih-alih membiarkannya hidup tanpa alasan.

---

## 4. Kebocoran cakupan yang ditemukan dan ditutup

Layak dibaca sebelum menulis penyaring cakupan berikutnya, karena bentuk kesalahannya akan berulang.

Versi pertama `ReviewItemRepository` menuliskan cakupan sebagai penyaring Prisma:

```ts
{ campaign: { scopes: { some: { applicationId: { in: scope } } } } }
```

Itu **lolos typecheck, lolos lint, dan salah**. Kalimatnya berbunyi "kampanye ini
memuat sedikitnya satu aplikasi yang boleh Anda lihat" — bukan "item ini milik
aplikasi yang boleh Anda lihat". Akibatnya satu kampanye yang menyentuh satu aplikasi
dalam cakupan seseorang membuka **seluruh** item kampanye itu baginya. Terbukti hidup:
`fajar.nugroho` dapat membaca item review milik `dewi.lestari`, HTTP 200.

Sebabnya bukan kecerobohan, dan itulah bagian yang penting. Aplikasi milik sebuah item
hanya dapat dicapai lewat `snapshot_line`, yang tidak punya kunci asing dari
`review_item` sehingga tidak punya relasi Prisma untuk ditelusuri (§3). Penyaring itu
ditulis terhadap apa yang **bisa dijangkau Prisma**, bukan terhadap apa yang
**dimaksud aturannya** — dan pendekatan terdekat yang bisa dijangkau ternyata jauh
lebih longgar.

Sekarang seleksinya SQL mentah (`scopedItemIds`) yang melakukan join sungguhan, dan
setiap pencari melewatinya. Pelajarannya: bila penyaring cakupan tidak dapat dinyatakan
persis dengan alat yang ada, jangan dekati — ganti alatnya.

---

## 5. Yang menghambat

### 5.1 Kunci API Gemini masih belum dicabut

Terbawa dari dua handoff sebelumnya dan **masih belum dikonfirmasi selesai**. Kunci pernah dikirim sebagai teks biasa lewat percakapan. Tidak pernah ditulis ke berkas mana pun, repo dipindai bersih pada setiap commit.

- [ ] Cabut kunci lama di Google AI Studio / Cloud Console
- [ ] Terbitkan kunci baru ke penyimpanan rahasia — bukan `.env`, bukan chat, bukan tiket
- [ ] Catat sebagai pemenuhan **G3** pada [ADR-03](docs/04-TRD.md)

### 5.2 Brand guideline belum diterima

Token `--tri-*` di [tokens.css](apps/web/src/styles/tokens.css) sengaja dikosongkan, dan sengaja **belum** dimasukkan ke `@theme` — entri `@theme` tanpa nilai membangkitkan kelas utilitas rusak yang merender warna kosong tanpa memberi tanda.

Seluruh layar memakai netral. **Jangan menebak warna merek dari tangkapan layar situs.**

### 5.3 Laporan "hanya direktur utama yang bisa masuk" — belum dapat direproduksi

Dilaporkan pada akhir sesi ini. **Tidak berhasil direproduksi di sini**, dan
belum terjawab — dicatat supaya tidak hilang, bukan karena sudah selesai.

Yang sudah diperiksa, seluruhnya lulus:

| Lapisan | Hasil |
|---|---|
| `POST /auth/login` untuk kesembilan pengguna benih | 9/9 berhasil |
| Halaman `/` untuk kesembilan pengguna | 9/9 HTTP 200 |
| Basis data | 9 pengguna aktif, peran dan cakupan benar |
| `SeedIdentityProvider.authenticate` | satu kata sandi bersama, tanpa percabangan per pengguna |
| Log peladen web | tanpa kesalahan |

`direktur.utama` memang berbeda dari delapan lainnya dalam satu hal: ia satu-satunya
yang **tanpa cakupan**, karena unitnya `DIR` (lihat `seed.ts`). Itu petunjuk yang
menggoda dan sudah ditelusuri — tetapi cakupan sama sekali tidak disentuh jalur
autentikasi. Ia hanya menentukan baris mana yang terlihat **setelah** masuk.

Yang perlu ditanyakan ke pelapor sebelum menebak lebih jauh: **pesan apa yang muncul.**
Ketiganya menunjuk ke tempat yang sangat berbeda:

- "Nama pengguna atau kata sandi salah" → API menolak; periksa `SEED_IDENTITY_PASSWORD`
  di `.env` dan apakah benihnya sudah dijalankan.
- "Sistem tidak dapat dihubungi" → `pnpm dev:api` tidak berjalan, atau `API_BASE_URL`
  tidak menunjuk ke porta 3001.
- Berhasil masuk tetapi layarnya kosong atau salah → bukan masalah login sama sekali,
  melainkan hak akses per layar. `admin.sigap` dan `direktur.utama` memang **seharusnya**
  melihat sedikit sekali layar (lihat tabel pengguna di README), dan itu ditegakkan
  lewat hak akses, bukan lewat menu.

Sebelum menelusuri lebih jauh, jalankan `pnpm db:seed` — sesi ini menambahkan garis
pelaporan atasan yang dibutuhkan RA-01, dan basis data yang belum diperbarui akan
berperilaku berbeda dari yang dijelaskan di sini.

### 5.4 Basis data sistem kemungkinan tercemar

Pada sesi lama, migrasi kemungkinan mendarat di PostgreSQL sistem di porta 5432. Porta pengembangan sudah dipindah ke 5442/6389/9010. Pembersihan basis data `sigap` dan peran `sigap_app` di instalasi sistem belum dilakukan.

---

## 6. Hal yang mudah disalahpahami

Ini yang tidak terlihat dari membaca kode saja. Yang baru ada di bagian bawah.

**Migrasi tidak pernah dijalankan sebagai `sigap_app`.** Pemilik objek memegang seluruh *grant option* secara permanen. Kalau `sigap_app` memiliki `audit_log`, ia bisa memberi `DELETE` kembali ke dirinya sendiri, membuang pemicu, lalu mengosongkan tabel — tiga pernyataan, tanpa hak tambahan. **Jangan pernah memberi `sigap_app` keanggotaan di `sigap_owner`** — satu `GRANT` itu membatalkan seluruh lapisan, dan secara senyap: semua tes tetap lulus.

**Rumus hash memakai pemisah U+001E, dan itu bagian dari kontrol.** Tanpa pemisah, pemberian `SYS_ADMIN` dan pencabutannya menghasilkan sidik jari identik. Rumus ini **tidak dapat diubah** setelah ada satu baris produksi. Sidik jari sign-off (K-9) memakai pemisah yang sama, karena alasan yang sama.

**`TRUNCATE` bukan `DELETE`.** Ia melewati pemicu tingkat baris. Pemicunya `FOR EACH STATEMENT`, dan `TRUNCATE` disebut eksplisit di `REVOKE`.

**`UnitOfWork.write()` menolak transaksi yang tidak menulis jejak audit.** Lupa mencatat menghasilkan tulisan yang **gagal**, bukan tulisan tanpa jejak. Jangan "memperbaiki" ini dengan membuat pengecualian. Konsekuensi yang tidak terduga: `verifyAgainstSnapshot` yang tidak menemukan apa pun untuk dikerjakan tetap harus mencatat sesuatu — ia mencatat `VERIFIKASI_PENCABUTAN_NIHIL`, supaya no-op yang sah tidak terlihat seperti jejak audit yang terlupakan.

**Penyamaran rahasia berjalan saat masuk, bukan saat tampil.** `audit_log` menolak `UPDATE` dan `DELETE`, jadi rahasia yang masuk ke sana masuk selamanya.

**Penyedia identitas demo menolak menyala di luar pengembangan.** `NODE_ENV` selain `development`/`test` membuat API gagal start. Skrip `dev:api` menyetelnya eksplisit.

**Navigasi yang disaring hak akses bukan kontrol.** FR-X-005 aturan 3 menyatakannya tegas.

**`prisma migrate dev` menggantung tanpa TTY.** Pakai `pnpm db:deploy` di skrip dan CI.

**Aturan lint `consistent-type-imports` dimatikan untuk `apps/api`.** `import type` menghapus metadata `design:paramtypes` yang dipakai NestJS untuk injeksi dependensi.

### Yang baru dari sesi ini

**K-1 ditegakkan di tiga lapisan, dan itu disengaja.** DTO tidak memuat `TERVERIFIKASI_TERTUTUP` sehingga permintaannya tidak dapat diucapkan; tabel transisi menolaknya sekiranya pemanggil lain muncul; `CHECK` di basis data menuntut `verified_by_snapshot_id`. Titik akhirnya adalah **aksi bernama** (`/claim`, `/complete`, `/exception`) sesuai kontrak, bukan satu bidang `status` — sebuah titik akhir yang tidak punya tempat untuk menuliskan status target tidak perlu memvalidasi apa pun, jadi tidak ada yang bisa salah divalidasi.

**Jumlah pengalihan dihitung dari `audit_log`, bukan dari kolom penghitung.** `audit_log` menolak `UPDATE` dan `DELETE`, jadi pengalihan tidak dapat disembunyikan dengan menulis ulang hitungannya. Kolom penghitung dapat dinolkan oleh siapa pun yang punya `UPDATE` pada `review_item`.

**Item yang barisnya snapshot-nya tidak dapat ditemukan diperlakukan sebagai paling berisiko, bukan paling aman.** Lihat `ItemRiskProfile` di `review-item.repository.ts`: konteks yang hilang tidak boleh menjadi alasan sebuah item menjadi layak disetujui lima puluh sekaligus.

**`seconds_spent` pada keputusan massal dibagi rata, bukan distempel penuh ke tiap baris.** Nilai itu memberi makan pendeteksi persetujuan asal-asalan (FR-B-014); mencatat 180 detik lima puluh kali justru menyembunyikan pola yang hendak ditemukan.

**`packages/db` kini ikut di-typecheck, termasuk `seed/`.** Sebelumnya `tsconfig.json`-nya hanya memuat `src`, sehingga nilai enum yang salah di benih baru ketahuan saat benihnya dijalankan. Gerbangnya langsung menemukan satu kesalahan tipe lama pada `seed.ts` begitu dinyalakan.

**Pratinjau dan peluncuran kampanye memakai satu jalur resolusi yang sama.** `CampaignBuilderService.resolveScope` dipanggil keduanya. Ini bukan penghematan kode: pratinjau yang dihitung oleh kode berbeda dari peluncuran adalah janji yang tidak ditepati sistem — penyusun mengambil keputusan atas angka yang tidak akan berlaku, dan baru tahu setelah empat ribu item terlanjur diarahkan ke orang yang salah.

**Pembekuan snapshot terjadi karena bentuknya, bukan karena penanda.** FR-B-008 aturan 1 menuntut snapshot dibekukan untuk kampanye. Tidak ada kolom `is_frozen` di mana pun: setiap `review_item` menunjuk satu baris `snapshot_line` tertentu, jadi kampanye meninjau persis baris yang ada saat peluncuran, dan snapshot berikutnya membuat baris baru tanpa menyentuh yang lama. Tidak ada penanda yang bisa lupa dipasang, dan tidak ada cara kampanye melayang ke data yang lebih baru.

**RA-04 sengaja tidak berfungsi.** Ia mengarah ke "pemilik hak akses", sedangkan `entitlement_catalog` tidak punya kolom pemilik. Ia menghasilkan nol reviewer sehingga seluruh itemnya jatuh ke cadangan — **terlihat di pratinjau**. Membuatnya diam-diam berperilaku seperti RA-02 akan membuat penyusun mengira ia mengatur sesuatu yang sebenarnya tidak diaturnya.

**Satu penghubung Redis dipakai dua kali, jadi logika penyambungannya dijadikan satu fungsi.** `ensureRedisReady` di `shared/redis/` menangani kasus yang membuat unggahan pertama gagal pada sesi ini: klien `lazyConnect` dengan `enableOfflineQueue: false` menolak perintah pertamanya, dan dua permintaan yang datang bersamaan sama-sama memanggil `connect()` sehingga yang kedua melempar "Redis is already connecting". Duplikat kedua dari lima belas baris siklus hidup koneksi adalah yang biasanya diperbaiki hanya di salah satu salinannya.

**Berkas ekspor sungguhan tidak seragam.** Penguraiannya menerima penanda urutan bita, CRLF, dan **pemisah titik koma** — yang ditulis Excel pada lokal Indonesia, dan penyebab keluhan "berkasnya kelihatan benar tapi semua barisnya ditolak". Baris penjelasan pada templat diawali `#` supaya pengunggah yang tidak menghapusnya tidak mengubah petunjuk menjadi baris data.

**Validasi memeriksa seluruh baris, bukan berhenti pada yang pertama.** Berhenti di baris bermasalah pertama menghasilkan putaran terburuk bagi pemilik aplikasi: perbaiki satu baris, unggah ulang, tunggu, temukan yang berikutnya.

**Tes integrasi kini membersihkan fixture-nya, kecuali yang ditolak jejak audit.** Sebelumnya baris "Aplikasi Uji" menumpuk di basis data pengembangan dan **muncul di registri aplikasi produk**, tanpa pembeda dari data asli. Pembersihannya membiarkan `app_user` gagal dihapus bila `audit_log.actor_id` merujuknya — penolakan itu adalah K-7 yang bekerja, bukan halangan yang perlu diakali. Baris `application`-lah yang wajib hilang, karena itu yang bocor ke antarmuka.

**Pembatalan kampanye berjalan menerima dua wewenang yang berbeda.** `campaign:write` **atau** peran COMPLIANCE cukup untuk masuk; servisnya tetap menuntut COMPLIANCE untuk kampanye yang sudah berjalan. Menuntut keduanya di titik masuk membuat jalur ini **mati** — tidak ada peran yang punya keduanya, dan aturan yang terbaca benar berubah menjadi jalur yang tidak pernah bisa dilalui siapa pun. Itu bug yang sungguh terjadi di sesi ini, bukan kehati-hatian teoretis.

**`ScopeFilter` membedakan "tanpa batasan" dari "dibatasi menjadi kosong".** Dimensi yang tidak ada berarti tidak dibatasi — keadaan sah bagi `COMPLIANCE` dan `AUDIT_LEAD`. Larik kosong berarti dibatasi menjadi tidak apa pun, dan harus cocok dengan nol baris. Menyamakan keduanya mengubah cakupan yang menyempit menjadi cakupan yang membuka semuanya.

---

## 7. Berikutnya, berurutan

1. ~~**Layar L-14 unggahan data akses (FR-B-004).**~~ **Selesai** (commit `2640682`). Tiga langkah dalam satu halaman: pilih aplikasi → unduh templat → unggah + validasi → pratinjau (baris sah, baris bermasalah, akun Tanpa Pemilik, peringatan penurunan) → konfirmasi tanpa pilihan bawaan → simpan. Unggahan dan unduhan CSV lewat server action Next sehingga token sesi tidak keluar dari kuki httpOnly. Respons commit menampilkan berapa tiket pencabutan yang tertutup (K-1 terlihat). Diuji ujung ke ujung terhadap tumpukan berjalan sebagai `rina.kusuma`. Nav digerbang `snapshot:upload`.
2. **Konektor otomatis (FR-B-003).** LDAP, JDBC, REST, SFTP. Modelnya sudah ada beserta `encrypted_credentials`, penjadwalan, dan penghitung kegagalan beruntun; tidak ada satu pun kodenya. Perlu sistem sungguhan untuk diuji, jadi nilainya untuk demo lebih rendah daripada butir 1 meskipun lingkupnya lebih besar.
3. ~~**Deteksi anomali dan SoD (FR-B-007, FR-B-024).**~~ **Selesai** (commit `f243709`). Mesin deteksi berjalan saat snapshot baru mendarat (`DetectionService`), setelah commit dan verifikasi, di luar transaksi tangkapan. Aturan sebagai modul murni (`access-detection.ts`): AN-01 (nonaktif tapi aktif, KRITIS per hak akses), AN-02 (Tanpa Pemilik, TINGGI per akun), AN-08/SoD lintas aplikasi (menyatukan kepemilikan tiap karyawan dari snapshot terbaru tiap aplikasi). Carry-forward FR-B-007 aturan 3 (umur dihitung sejak pertama terdeteksi, tidak menduplikasi). Titik akhir: `GET /access-anomalies` + `/exception` + `/resolve`, `GET /sod-rules`, `GET /sod-violations`, `POST /sod-rules/simulate` (aturan 4, evaluator sama dengan deteksi), `POST /sod-violations/{id}/exception` (FR-B-025). Semua tulis lewat `UnitOfWork` + jejak audit (K-7). 22 tes baru, 104 total lulus. Belum ada layar (L-15 Dasbor Kepatuhan menampilkannya kelak).
4. **Paket bukti kampanye (FR-B-022, FR-B-023).** Penanda keputusan massal sudah tercatat di jejak audit dan diminta muncul di paket bukti (FR-B-013 aturan 5) — paketnya sendiri belum ada.
5. **Pekerjaan terjadwal.** Dua fungsi menunggu pemanggil: `ensure_snapshot_line_partitions_ahead()` dan `RevocationService.markUnverifiable()` (FR-B-020 aturan 3). Keduanya benar; keduanya belum pernah berjalan.
6. **Direktori pengguna (FR-X-014).** Wisaya kampanye hanya dapat menawarkan pengguna yang sedang masuk sebagai reviewer cadangan, karena tidak ada titik akhir yang mendaftar pengguna. FR-B-009 aturan 1 mewajibkan cadangan, jadi ini membatasi siapa yang dapat menyusun kampanye untuk orang lain.
7. **Modul C · Policy Hub** — sisa Fase 1.

### Modul A · Evidence Vault — status

**Selesai penuh (FR-A-001 s.d. FR-A-018)** — commit `dcff234`, `4910b44`, `97a0e86`, `f931c1e`:
- FR-A-001..003 · pustaka kontrol, framework, pemetaan + tampilan cakupan.
- FR-A-004..005 · penugasan + siklus hidup (state machine, scope tim, legal hold).
- FR-A-006..009 · permintaan bukti (PBC), daftar tugas PIC, kesiapan.
- FR-A-010..014 · bukti entitas mandiri, versi + **integritas K-8** (SHA-256, tolak duplikat, verifikasi unduh, atestasi rantai kepemilikan).
- FR-A-015 · retensi + penahanan hukum + antrean penghapusan (persetujuan COMPLIANCE + step-up).
- FR-A-016..017 · temuan + tindak lanjut (SLA per risiko, tutup AUDIT_LEAD, terima-risiko direksi).
- FR-A-018 · portal auditor eksternal (undangan FR-X-004, akses terikat waktu, baca hanya bukti DITERIMA, usulan permintaan, tanda air, tiap baca teraudit).

**Menyisakan hanya:** object-lock penyimpanan fisik (K-8 rule 3) yang menunggu backend penyimpanan objek.

Setelah menyentuh kontrol kritis mana pun: jalankan skill `critical-controls`, lalu subagent `security-reviewer`. Daftar periksa menangkap pelanggaran yang terlihat; review adversarial menangkap yang tersembunyi — kebocoran cakupan di §4 tidak akan tertangkap oleh daftar periksa.

---

## 8. Utang yang sudah diketahui

| Hal | Akibat bila dibiarkan |
|---|---|
| Pemotongan **ekor** rantai audit tidak terdeteksi | ADR-04 menuntut sidik jari kepala rantai disalin ke penyimpanan log di luar basis data. Belum ada |
| Tidak ada penegakan rantai saat `INSERT` | `hash` dan `prev_hash` hanya kolom teks. Baris palsu dapat disisipkan oleh siapa pun yang punya `INSERT` |
| **Pelaksana tiket tidak punya `ticket:execute`** | FR-B-018 aturan 1 mengarahkan tiket ke pemilik teknis aplikasi, tetapi FRD §1.4 hanya memberi `SEC_OFFICER` wewenang melaksanakannya. Pada demo, tiket ditugaskan ke `agus.santoso` yang **tidak dapat** mengerjakannya. Salah satu dari keduanya harus berubah — dan itu keputusan dokumen, bukan keputusan kode |
| **Delegasi dapat memutuskan tetapi tidak dapat menandatangani** | `itemsInSignoffScope` menyaring `reviewer_id = diri sendiri`, sehingga item milik pemberi delegasi tidak masuk cakupan sign-off penerima delegasi. Mungkin memang benar — menandatangani bersifat pribadi — tetapi FR-X-007 tidak menyatakannya |
| **Sign-off dua lapis belum teruji** | `layerNo` diambil dari `Math.max` atas item; reviewer yang memegang item lapis 1 **dan** 2 akan menandatangani seluruhnya sebagai lapis 2. FR-B-017 aturan 3 belum punya data uji |
| **Tiket `UBAH` tidak pernah terverifikasi otomatis** | Hilangnya hak akses bukan bukti bahwa ia *diturunkan*. Skema tidak menyimpan hak akses tujuan, jadi tiket `UBAH` sengaja ditahan alih-alih ditutup dengan bukti yang tidak menjawab pertanyaannya |
| `employee.email` tanpa `UNIQUE` | Mengikuti ERD persis; data HR rawan duplikat |
| `employee_history` belum dimodelkan | FR-X-017 aturan 3 menuntut sistem bisa menjawab "siapa atasan orang ini pada tanggal itu" |
| Titik akhir sesi belum ada di kontrak API | FR-X-002 menjanjikan pengakhiran sesi jarak jauh; [07-API-CONTRACT](docs/07-API-CONTRACT.md) belum memuatnya |
| Satu token buram, bukan JWT + refresh | Menyimpang dari [07-API-CONTRACT §2.1](docs/07-API-CONTRACT.md). Alasannya di badan `31c8c01`. Perlu `doc-sync` |
| Kolom tambahan `audit_log` belum masuk TRD | `actor_role_at_action`, `session_id`, `request_id` dituntut FR-X-008 tapi tidak ada di ERD TRD §3.1 |
| Aturan ADR-03 di ESLint mudah dilewati | Tidak menangkap `import()` dinamis, `require()`, maupun `fetch` langsung |
| `docs/DEV-CREDENTIALS.md` tidak ikut di-commit | Berkas tak terlacak yang akan muncul di `git status`. Isinya hanya kata sandi demo yang sudah tertulis di README, dan tajuknya sendiri menyatakan jangan di-commit — jadi ia sengaja dibiarkan di luar repo, bukan terlupakan |
| Kata sandi bawaan `docker-compose` memakai `:-` | `.env` yang hilang menghasilkan tumpukan yang berjalan mulus dengan kredensial tertulis di git |
| Model `Connector` dan `AccessAnomaly` belum punya kode pemakai | Dipertahankan karena TRD §3.3 menyebutnya eksplisit di ERD. Membuangnya menciptakan penyimpangan dokumen-kode |
| **RA-04 tidak dapat diterapkan** | FR-B-009 mendefinisikan "pemilik hak akses", tetapi `entitlement_catalog` tidak punya kolom pemilik (TRD §3.3). Aturannya sengaja menghasilkan nol reviewer sehingga seluruh item jatuh ke cadangan secara **terlihat** di pratinjau, alih-alih diam-diam berperilaku seperti RA-02. Perlu kolom baru atau penghapusan RA-04 dari FRD |
| **Snapshot bertanggal masa depan tidak ditolak** | Umur snapshot dihitung `now - captured_at`, jadi snapshot bertanggal besok berumur negatif dan lolos batas 7 hari. Data konektor sungguhan tidak akan begitu, tetapi unggahan manual (FR-B-006) bisa |
| **XLSX belum didukung** | FR-B-004 menyebut CSV **atau** XLSX. Hanya CSV yang dibaca; `.xlsx` ditolak dengan pesan yang menyebutkan alasannya, bukan gagal sebagai kesalahan penguraian. Berkas baris bermasalah karenanya juga CSV, bukan `errors.xlsx` seperti pada contoh kontrak lama. Kontraknya sudah disesuaikan |
| **FR-B-006 aturan 2 dan 3 belum ada** | Pemetaan berbasis kemiripan nama menuntut konfirmasi manusia (aturan 2) dan pemetaan manual harus tersimpan permanen (aturan 3). Keduanya butuh tabel pemetaan yang belum ada di skema. Kaskadenya karena itu berhenti pada tiga langkah deterministik, dan sisanya menjadi Tanpa Pemilik — **terlihat**, alih-alih ditebak diam-diam |
| **Retensi snapshot belum ditegakkan** | FR-B-005 aturan 3 menuntut minimal 24 snapshot per aplikasi atau seluruhnya dalam 3 tahun. Tidak ada yang membuang apa pun, jadi saat ini sistem menyimpan lebih banyak daripada yang diminta — arah yang aman, tetapi bukan yang tertulis |
| **Siapa pun yang dapat menulis snapshot dapat menutup tiket** | Sifat rancangan, bukan cacat: snapshot **adalah** buktinya (K-1), dan FRD §1.4 memberi `snapshot:upload` hanya kepada `SEC_OFFICER`. Yang menjaganya adalah jejak audit — nama pengunggah, nama berkas, sidik jari isi, dan alasan konfirmasi tercatat pada setiap unggahan. Perlu diketahui sebelum hak itu diberikan ke peran lain |
| **Ambang penurunan baris membandingkan snapshot terbaru menurut `captured_at`** | Snapshot bertanggal masa depan karenanya menjadi pembanding. Basis data pengembangan saat ini memuat satu (bertanggal 28 Agustus 09:00 UTC, dibuat manual pada sesi sebelumnya) dan **tidak boleh dihapus** — ia adalah bukti yang menutup tiket TKT-2026-000001 |
| **Pembatalan kampanye berjalan menuntut dua hal berbeda** | Titik akhirnya menerima `campaign:write` **atau** peran COMPLIANCE, karena tidak ada peran yang punya keduanya — menuntut keduanya membuat jalur ini mati. Servisnya tetap menuntut COMPLIANCE untuk kampanye berjalan. Bila FRD §1.4 kelak memberi COMPLIANCE `campaign:write`, gerbang ganda ini dapat disederhanakan |

---

## 9. Verifikasi keadaan sehat

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm verify:docs
```

Keempatnya harus lulus. `verify:docs` menggagalkan build bila keterlacakan ID lintas
dokumen putus — dokumen adalah sumber kebenaran, dan itu ditegakkan, bukan diimbau.
