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

| Username | Password | Role | Jabatan | Divisi |
|---|---|---|---|---|
| `bayu.pratama` | `demo` | AUDIT_LEAD, EMPLOYEE | Kepala SKAI | SKAI |
| `sari.dewi` | `demo` | AUDITOR_INT, EMPLOYEE | Auditor Internal Senior | SKAI |
| `hendra.wijaya` | `demo` | COMPLIANCE, EMPLOYEE | Compliance Officer | Kepatuhan |
| `rina.kusuma` | `demo` | SEC_OFFICER, EMPLOYEE | IT Security Officer | TI |
| `agus.santoso` | `demo` | APP_OWNER, LINE_MANAGER, EMPLOYEE | Kepala Divisi TI | TI |
| `dewi.lestari` | `demo` | APP_OWNER, LINE_MANAGER, EMPLOYEE | Kepala Operasional | Operasional |
| `fajar.nugroho` | `demo` | LINE_MANAGER, EMPLOYEE | Kepala Cabang Jakarta | Ritel & Cabang |
| `admin.sigap` | `demo` | SYS_ADMIN | Administrator Sistem | TI |
| `direktur.utama` | `demo` | EXECUTIVE, EMPLOYEE | Direktur Utama | Direksi |

---

## Catatan Akses

- **`admin.sigap`** — hanya bisa akses Registri Aplikasi. Sengaja **tidak bisa** menyetujui bukti, menandatangani review, atau mengesahkan dokumen (FRD §1.4).
- **`direktur.utama`** — akses level eksekutif, tidak punya akses audit operasional.
- **`bayu.pratama`** — user utama untuk testing alur audit end-to-end.

---

## Cara Menjalankan Seed

Pastikan infra sudah jalan dan migrasi sudah diapply:

```bash
bun run infra:up        # jalankan Docker (postgres, redis, minio)
bun run db:setup        # deploy migrasi + setup role DB
bun run db:generate     # generate Prisma client
bun run db:seed         # insert data benih (idempotent, aman diulang)
```
