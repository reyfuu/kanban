#!/usr/bin/env python3
"""
Verifikasi konsistensi dokumen SIGAP.

Memeriksa: keterlacakan ID, tautan antar-dokumen, keseimbangan pagar kode,
validitas JSON dan YAML, istilah baku, dan angka yang diklaim README.

Pakai:
    python3 .claude/skills/verify-docs/scripts/verify.py [docs_dir]

Keluar dengan kode 1 bila ada temuan yang menghambat.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

BLOCKING: list[str] = []
WARNING: list[str] = []


def block(msg: str) -> None:
    BLOCKING.append(msg)


def warn(msg: str) -> None:
    WARNING.append(msg)


def strip_code(text: str) -> str:
    """Buang blok kode agar tidak menghasilkan positif palsu."""
    return re.sub(r"^```.*?^```", "", text, flags=re.S | re.M)


def expand_ranges(text: str) -> set[str]:
    """
    'FR-B-008 s.d. FR-B-010' -> {FR-B-008, FR-B-009, FR-B-010}
    Notasi rentang dipakai di matriks keterlacakan README.
    """
    found: set[str] = set()
    pattern = r"(FR-[XABC])-(\d+)\s+s\.d\.\s+FR-[XABC]-(\d+)"
    for prefix, start, end in re.findall(pattern, text):
        for n in range(int(start), int(end) + 1):
            found.add(f"{prefix}-{n:03d}")
    return found


# ---------------------------------------------------------------- pemeriksaan


def check_links(docs: dict[str, str], names: set[str]) -> None:
    for fn, text in docs.items():
        for m in re.finditer(r"\]\((\d\d-[A-Za-z-]+\.md)(#[^)]*)?\)", text):
            if m.group(1) not in names:
                line = text[: m.start()].count("\n") + 1
                block(f"Tautan rusak  {fn}:{line} -> {m.group(1)}")


def check_fences(docs: dict[str, str]) -> None:
    for fn, text in docs.items():
        n = len(re.findall(r"^```", text, re.M))
        if n % 2:
            block(f"Pagar kode ganjil  {fn} ({n} pagar) — ada blok tidak tertutup")


def check_json(docs: dict[str, str]) -> None:
    total = bad = 0
    for fn, text in docs.items():
        for m in re.finditer(r"^```json\n(.*?)^```", text, re.S | re.M):
            total += 1
            try:
                json.loads(m.group(1))
            except json.JSONDecodeError as e:
                bad += 1
                line = text[: m.start()].count("\n") + 1
                block(f"JSON tidak valid  {fn}:{line} — {e.msg} (baris {e.lineno} blok)")
    print(f"  JSON  : {total - bad}/{total} valid")


def check_yaml(docs: dict[str, str]) -> None:
    if yaml is None:
        warn("PyYAML tidak terpasang — validasi YAML dilewati (pip install pyyaml)")
        return
    total = bad = 0
    for fn, text in docs.items():
        for m in re.finditer(r"^```yaml\n(.*?)^```", text, re.S | re.M):
            total += 1
            try:
                yaml.safe_load(m.group(1))
            except yaml.YAMLError as e:
                bad += 1
                line = text[: m.start()].count("\n") + 1
                block(f"YAML tidak valid  {fn}:{line} — {e}")
    print(f"  YAML  : {total - bad}/{total} valid")


def check_ids(docs: dict[str, str]) -> None:
    """Setiap ID yang dirujuk harus terdefinisi di dokumen sumbernya."""
    joined = "\n".join(docs.values())

    specs = [
        # (label, pola definisi, berkas sumber, pola rujukan)
        ("FR", r"^#+ (FR-[XABC]-\d+)", "03-FRD.md", r"\bFR-[XABC]-\d+\b"),
        ("US", r"\*\*(US-[XABC]-\d+)", "02-PRD.md", r"\bUS-[XABC]-\d+\b"),
        ("ADR", r"^#+ (ADR-\d+)", "04-TRD.md", r"\bADR-\d+\b"),
        ("Layar", r"^### (L-\d+)", "05-UIUX-FLOW.md", r"\bL-\d{2}\b"),
        ("Agent", r"^### (AG-\d+)", "08-AGENT-SPEC.md", r"\bAG-\d+\b"),
        ("Guardrail", r"^#+ (GR-\d+\.\d+)", "09-GUARDRAILS.md", r"\bGR-\d+\.\d+\b"),
        ("TC-AI", r"\| (TC-AI-\d+)", "10-TEST-PLAN.md", r"\bTC-AI-\d+\b"),
    ]

    for label, def_re, src, ref_re in specs:
        if src not in docs:
            warn(f"Berkas sumber {label} tidak ditemukan: {src}")
            continue
        defined = set(re.findall(def_re, docs[src], re.M))
        referenced = set(re.findall(ref_re, joined))
        missing = referenced - defined
        if missing:
            for mid in sorted(missing):
                block(f"{label} dirujuk tapi tidak terdefinisi di {src}: {mid}")
        print(f"  {label:<10}: {len(defined)} terdefinisi, {len(referenced)} dirujuk — OK"
              if not missing else f"  {label:<10}: {len(missing)} rujukan menggantung")


def check_us_traced(docs: dict[str, str]) -> None:
    """Setiap user story harus punya jejak di FRD."""
    if "02-PRD.md" not in docs or "03-FRD.md" not in docs:
        return
    us = set(re.findall(r"\*\*(US-[XABC]-\d+)", docs["02-PRD.md"]))
    traced = set(re.findall(r"\bUS-[XABC]-\d+\b", docs["03-FRD.md"]))
    orphan = us - traced
    for o in sorted(orphan):
        block(f"User story tanpa requirement di FRD: {o}")
    print(f"  US->FR    : {len(us) - len(orphan)}/{len(us)} tertrace")


def check_fr_in_matrix(docs: dict[str, str]) -> None:
    """Setiap FR sebaiknya muncul di matriks keterlacakan README."""
    if "00-README.md" not in docs or "03-FRD.md" not in docs:
        return
    defined = set(re.findall(r"^#+ (FR-[XABC]-\d+)", docs["03-FRD.md"], re.M))
    readme = docs["00-README.md"]
    listed = set(re.findall(r"\bFR-[XABC]-\d+\b", readme)) | expand_ranges(readme)
    missing = defined - listed
    if missing:
        warn(f"{len(missing)} FR belum muncul di matriks README: "
             + ", ".join(sorted(missing)[:8])
             + (" ..." if len(missing) > 8 else ""))
    print(f"  FR->README: {len(defined) - len(missing)}/{len(defined)} termasuk matriks")


TERMS = {
    "peninjau": "reviewer",
    "app owner": "pemilik aplikasi",
    "dokumen pendukung": "bukti",
    "segregation of duties": "pemisahan tugas",
    "acknowledgment": "pernyataan telah membaca",
    "entitlement snapshot": "snapshot hak akses",
}


def check_terminology(docs: dict[str, str]) -> None:
    """
    Istilah baku docs/06-DESIGN.md §7.2.

    Tiga penyaring positif palsu, ketiganya diperlukan:
      1. Batas kata — agar 'peninjauan' (siklus tinjauan) tidak tertangkap
         oleh 'peninjau' (peran reviewer). Dua hal yang berbeda.
      2. Baris yang memuat istilah salah DAN istilah benar sekaligus adalah
         baris glosarium yang memang mendaftarkan keduanya berdampingan.
      3. Tabel yang kepala kolomnya memuat 'salah' atau 'tidak dipakai' adalah
         tabel contoh — isinya sengaja memuat istilah yang dilarang.

    Nomor baris dihitung terhadap berkas asli, bukan terhadap teks yang sudah
    dibuang blok kodenya, sehingga dapat langsung dibuka di editor.
    """
    hits = 0
    for fn, text in docs.items():
        in_fence = False
        example_table = False
        for i, line in enumerate(text.splitlines(), start=1):
            if line.startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                continue

            low = line.lower()

            # lacak konteks tabel: kepala kolom menentukan sifat isinya
            if line.lstrip().startswith("|"):
                if re.search(r"\bsalah\b|tidak dipakai", low):
                    example_table = True
            else:
                example_table = False

            if example_table:
                continue

            for bad, good in TERMS.items():
                if not re.search(rf"\b{re.escape(bad)}\b", low):
                    continue
                if good.lower() in low:  # baris glosarium
                    continue
                warn(f"Istilah  {fn}:{i}  '{bad}' -> seharusnya '{good}'")
                hits += 1
    print(f"  Istilah   : {'bersih' if not hits else f'{hits} penyimpangan'}")


def check_readme_counts(docs: dict[str, str]) -> None:
    """README menyebut angka. Angka yang tidak diverifikasi cenderung basi."""
    if "00-README.md" not in docs:
        return
    readme = docs["00-README.md"]
    actual = {
        "requirement fungsional": len(set(re.findall(
            r"^#+ FR-[XABC]-\d+", docs.get("03-FRD.md", ""), re.M))),
        "user story": len(set(re.findall(
            r"\*\*US-[XABC]-\d+", docs.get("02-PRD.md", "")))),
        "guardrail": len(set(re.findall(
            r"^#+ GR-\d+\.\d+", docs.get("09-GUARDRAILS.md", ""), re.M))),
        # spasi dinormalkan: penjajaran kolom membuat "GET  /x" dan
        # "GET   /x" terhitung dua kali bila tidak diratakan
        "titik akhir": len({
            re.sub(r"\s+", " ", re.sub(r"/api/v1", "", m)).strip()
            for m in re.findall(
                r"^(?:GET|POST|PATCH|PUT|DELETE) +/\S*",
                docs.get("07-API-CONTRACT.md", ""), re.M)
        }),
    }
    for label, n in actual.items():
        m = re.search(rf"(\d+)\s+{re.escape(label)}", readme)
        if m and int(m.group(1)) != n:
            warn(f"Angka README '{label}': tertulis {m.group(1)}, sebenarnya {n}")
    print("  Angka     : " + " · ".join(f"{k}={v}" for k, v in actual.items()))


# ---------------------------------------------------------------------- main


def main() -> int:
    docs_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "docs")
    if not docs_dir.is_dir():
        print(f"Direktori tidak ditemukan: {docs_dir}", file=sys.stderr)
        return 2

    files = sorted(docs_dir.glob("*.md"))
    if not files:
        print(f"Tidak ada berkas .md di {docs_dir}", file=sys.stderr)
        return 2

    docs = {f.name: f.read_text(encoding="utf-8") for f in files}
    names = set(docs)

    print(f"\nVerifikasi {len(docs)} dokumen di {docs_dir}/\n")

    check_links(docs, names)
    check_fences(docs)
    check_json(docs)
    check_yaml(docs)
    check_ids(docs)
    check_us_traced(docs)
    check_fr_in_matrix(docs)
    check_terminology(docs)
    check_readme_counts(docs)

    print()
    if WARNING:
        print(f"PERINGATAN ({len(WARNING)})")
        for w in WARNING:
            print(f"  {w}")
        print()
    if BLOCKING:
        print(f"MENGHAMBAT ({len(BLOCKING)})")
        for b in BLOCKING:
            print(f"  {b}")
        print("\nHASIL: GAGAL")
        return 1

    print("HASIL: LULUS" + (f" (dengan {len(WARNING)} peringatan)" if WARNING else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
