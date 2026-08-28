# Kredensial Pengguna Demo (Development Only)

> [!CAUTION]
> Dokumen ini **HANYA untuk pengembangan lokal**. Jangan di-commit ke repository produksi
> atau dibagikan ke luar tim pengembang.

## Password

Semua pengguna benih memakai **satu password yang sama**:

```
demo
```

Dapat diubah via environment variable sebelum menjalankan seed:

```bash
SEED_IDENTITY_PASSWORD=passwordbaru bun run db:seed
```

---

## Daftar Pengguna

### Pengguna internal

| Username | Password | Role | Jabatan | Divisi | Atasan |
|---|---|---|---|---|---|
| `bayu.pratama` | `demo` | AUDIT_LEAD, DOC_APPROVER, EMPLOYEE | Kepala SKAI | SKAI | Direktur Utama |
| `sari.dewi` | `demo` | AUDITOR_INT, EMPLOYEE | Auditor Internal Senior | SKAI | Bayu Pratama |
| `hendra.wijaya` | `demo` | COMPLIANCE, DOC_AUTHOR, EMPLOYEE | Compliance Officer | Kepatuhan | Direktur Utama |
| `rina.kusuma` | `demo` | SEC_OFFICER, EMPLOYEE | IT Security Officer | TI | Agus Santoso |
| `agus.santoso` | `demo` | APP_OWNER, LINE_MANAGER, EMPLOYEE | Kepala Divisi TI | TI | Direktur Utama |
| `dewi.lestari` | `demo` | APP_OWNER, LINE_MANAGER, DOC_AUTHOR, EMPLOYEE | Kepala Operasional | Operasional | Direktur Utama |
| `fajar.nugroho` | `demo` | LINE_MANAGER, EMPLOYEE | Kepala Cabang Jakarta | Ritel & Cabang | Direktur Utama |
| `joko.susilo` | `demo` | EVIDENCE_PIC, EMPLOYEE | Supervisor Operasional | Operasional | Dewi Lestari |
| `putri.handayani` | `demo` | EMPLOYEE | Staf Ritel | Ritel & Cabang | Fajar Nugroho |
| `admin.sigap` | `demo` | SYS_ADMIN | Administrator Sistem | TI | Agus Santoso |
| `direktur.utama` | `demo` | EXECUTIVE, EMPLOYEE | Direktur Utama | Direksi | — |

### Pengguna eksternal

| Username | Password | Role | Keterangan |
|---|---|---|---|
| `budi.harjono` | `demo` | AUDITOR_EXT | Bukan karyawan, tanpa baris `employee` dan tanpa atasan. Kedaluwarsa 180 hari sejak seed dijalankan (FR-X-004) |

### Peran mana untuk menguji apa

| Ingin menguji | Masuk sebagai |
|---|---|
| Pengalaman karyawan biasa: pencarian, baca SOP, attestation | `putri.handayani` |
| Keputusan review akses oleh atasan (FR-B-012) | `fajar.nugroho`, dengan Putri sebagai bawahannya |
| Pemenuhan permintaan bukti (FR-A-004) | `joko.susilo` |
| Penyusunan kampanye dan pemantauannya | `rina.kusuma` |
| Penyediaan data akses dan sign-off pemilik aplikasi | `agus.santoso`, `dewi.lestari` |
| Penyusunan dokumen sampai pengesahan (Modul C) | Tulis dengan `hendra.wijaya`, sahkan dengan `bayu.pratama` |
| Alur audit end-to-end | `bayu.pratama` |
| Akses terbatas auditor eksternal (FR-X-004) | `budi.harjono` |

---

## Catatan Akses

- **`admin.sigap`** — hanya bisa akses Registri Aplikasi. Sengaja **tidak bisa** menyetujui bukti, menandatangani review, atau mengesahkan dokumen (FRD §1.4).
- **`direktur.utama`** — akses level eksekutif, tidak punya akses audit operasional.
- **`bayu.pratama`** — user utama untuk testing alur audit end-to-end.
- **`putri.handayani`** — satu-satunya akun tanpa peran tambahan. Dipakai untuk memeriksa bahwa pengalaman dasar karyawan benar-benar dapat dijalankan tanpa hak istimewa apa pun, dan sekaligus memberi Fajar Nugroho seorang bawahan sungguhan agar aturan penugasan RA-01 dapat diuji.
- **`joko.susilo`** — memegang `EVIDENCE_PIC` tanpa peran manajerial, sehingga dapat dibuktikan bahwa penyedia bukti tidak dapat sekaligus menyetujui bukti yang ia serahkan sendiri.
- **`budi.harjono`** — akun eksternal tanpa baris `employee`. Ini disengaja: memberinya catatan kepegawaian akan memasukkan orang luar ke dalam bagan organisasi, tempat RA-01 dapat mengarahkan item review kepadanya. Kedaluwarsanya disetel 180 hari saat seed dijalankan, bukan dibiarkan kosong, karena akun demo justru yang paling mudah terlupakan.
- **Pemisahan menulis dan mengesahkan dokumen** — `hendra.wijaya` dan `dewi.lestari` menulis, `bayu.pratama` mengesahkan. Tidak ada akun yang memegang keduanya.

---

## Cara Menjalankan Seed

Pastikan infra sudah jalan dan migrasi sudah diapply:

```bash
bun run infra:up        # jalankan Docker (postgres, redis, minio)
bun run db:setup        # deploy migrasi + setup role DB
bun run db:generate     # generate Prisma client
bun run db:seed         # insert data benih (idempotent, aman diulang)
```
