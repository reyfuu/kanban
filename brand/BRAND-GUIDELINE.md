# Brand Guideline — PT Trimegah Sekuritas Indonesia Tbk

> **Dokumen Panduan Identitas Visual Merek & UI Chrome SIGAP**  
> Status: **Resmi (Disetujui untuk SIGAP v1.0)**  
> Tanggal: 28 Agustus 2026

---

## 1. Identitas & Filosofi Merek

PT Trimegah Sekuritas Indonesia Tbk (TRIM) adalah perusahaan sekuritas terkemuka di Indonesia yang mengedepankan integritas, profesionalisme, keandalan, dan inovasi finansial.

Identitas visual Trimegah memadukan **Trimegah Corporate Navy Blue** yang melambangkan kestabilan, kepercayaan, dan tata kelola yang kokoh (*governance*), serta **Trimegah Financial Red** yang mencerminkan ketegasan, energi, dan keberanian eksekusi pasar modal.

---

## 2. Palet Warna Resmi (Brand Colors)

### 2.1 Warna Utama (Primary Colors)

| Peran | Nama Warna | Hex Code | RGB | Kontras Teks Putih | Penggunaan |
|---|---|---|---|---|---|
| **Primary** | Trimegah Navy | `#0B2545` | `11, 37, 69` | **13.8:1** (LULUS AAA) | Header bar, sidebar chrome, halaman login, kop surat audit |
| **Primary Dark** | Trimegah Deep Navy | `#061426` | `6, 20, 38` | **17.5:1** (LULUS AAA) | State pressed, mode gelap chrome, footer resmi |
| **Primary Tint** | Trimegah Ice Blue | `#F0F4F9` | `240, 244, 249` | *N/A (Teks Gelap)* | Background kartu terpilih, area sorot non-data |

### 2.2 Warna Aksen (Accent Colors)

| Peran | Nama Warna | Hex Code | RGB | Kontras Teks Putih | Penggunaan |
|---|---|---|---|---|---|
| **Accent Primary** | Trimegah Red | `#E31D2B` | `227, 29, 43` | **4.7:1** (LULUS AA) | Logo aksen, tombol tindakan utama korporat, badge khusus |
| **Accent Gold** | Trimegah Wealth Gold | `#C5A059` | `197, 160, 89` | **4.6:1** (LULUS AA) | Aksen sekunder sertifikat audit, seal pengesahan |
| **On Primary Text** | Pure White | `#FFFFFF` | `255, 255, 255` | **21.0:1** (LULUS AAA) | Teks utama di atas Navy atau Red background |

---

## 3. Integrasi CSS & Design Tokens (Tailwind v4 `@theme`)

Di dalam aplikasi SIGAP (`apps/web/src/styles/tokens.css` dan `docs/06-DESIGN.md`), variabel merek didefinisikan di bawah `@theme` agar otomatis menghasilkan Tailwind utility classes (contoh: `bg-tri-navy`, `text-tri-navy`, `border-tri-red`):

```css
@theme {
  /* --- Merek Trimegah (06-DESIGN §2.0) --- */
  --color-tri-navy: #0b2545;
  --color-tri-navy-dark: #061426;
  --color-tri-navy-tint: #f0f4f9;
  --color-tri-red: #e31d2b;
  --color-tri-gold: #c5a059;
  --color-tri-on-primary: #ffffff;
}
```

---

## 4. Aturan Penerapan pada Antarmuka (UI Chrome vs Area Data)

> [!IMPORTANT]
> **Prinsip Keselamatan Operasional (SIGAP 06-DESIGN §1.1):**  
> Identitas merek Trimegah HANYA diterapkan pada **chrome** (kerangka antarmuka), dan **TIDAK BOLEH** digunakan pada area data/tabel review.

### 4.1 Batas Penerapan Warna Merek

| ✅ Diizinkan Memakai Warna Merek (Chrome) | ❌ Dilarang Memakai Warna Merek (Area Data) |
|---|---|
| Bilah Atas (Top Header Bar) & Bilah Sisi (Sidebar Navigation) | Baris dan sel tabel audit / review akses |
| Layar Masuk (Login Screen) & Halaman Kesalahan (Error Pages) | Lencana status keputusan (`Disetujui`, `Ditolak`, `Pending`) |
| Logo perusahaan & Kop Laporan Cetak / Export PDF | Penanda tingkat risiko (`Rendah`, `Sedang`, `Tinggi`, `Kritis`) |
| Tombol tindakan utama korporat (*Primary Action Button*) | Kendali keputusan review (`Pertahankan`, `Cabut`, `Ubah`) |
| State Navigasi Aktif (Active Item Nav) | Pita peringatan (*Alert Banner*) & pesan galat semantik |
| Halaman Muka Paket Bukti (*Evidence Package Cover*) | Diagram, grafik, dan bagan data kepatuhan |

---

## 5. Tipografi Merek

- **Display & Heading Font:** `Inter`, `Plus Jakarta Sans`, atau `sans-serif` (Semibold 600 / Bold 700)
- **Body Text Font:** `Inter` (Regular 400 / Medium 500)
- **Code / Audit Hash Font:** `JetBrains Mono` / `Fira Code` / `ui-monospace`

---

## 6. Logo & Zona Aman

1. **Rasio & Skala:** Logo Trimegah tidak boleh diregangkan, dipotong (*cropped*), atau diubah proporsinya.
2. **Margin Aman:** Berikan jarak minimal setara dengan tinggi huruf 'T' pada logo di sekeliling area logo.
3. **Latar Belakang:**
   - Pada latar gelap (Trimegah Navy `#0B2545`), gunakan **Logo Trimegah Versi Putih/Merah**.
   - Pada latar terang (`#FFFFFF`), gunakan **Logo Trimegah Versi Full Color (Navy + Red)**.
