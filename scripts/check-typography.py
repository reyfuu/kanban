#!/usr/bin/env python3
"""
Ukur keterbacaan tipografi pada 1366x768.

KENAPA ADA. 1366x768 masih resolusi laptop kantor yang paling umum, dan ia
bukan sekadar "layar kecil": lebarnya cukup untuk tata letak desktop penuh
sementara tingginya hanya 768px, sehingga tabel padat dan teks kecil menumpuk
pada ruang vertikal yang sedikit. Keluhan "fontnya" pada layar seperti ini
hampir selalu dua hal yang terukur -- ukuran teks di bawah ambang nyaman, dan
jumlah baris yang muat sebelum harus menggulir.

Skrip ini melaporkan angka, bukan pendapat: ukuran font efektif tiap elemen
teks yang benar-benar dirender, berapa yang di bawah ambang, dan berapa tinggi
konten dibanding viewport. Dijalankan seperti verify-ui.py:

    ./scripts/dev.sh up && python3 scripts/check-typography.py
"""

import sys
import importlib.util
from collections import Counter
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "verify_ui", Path(__file__).with_name("verify-ui.py")
)
verify_ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_ui)

Browser = verify_ui.Browser
login = verify_ui.login
SCREENS = verify_ui.SCREENS

LAPTOP = (1366, 768)

# 12px adalah lantai praktis untuk teks yang harus dibaca berulang di layar
# kerja. 06-DESIGN memang mendefinisikan langkah 11px ("2xs"), tetapi itu untuk
# eyebrow dan badge -- label pendek yang dipindai, bukan dibaca. Ambang ini
# karenanya diterapkan pada teks isi, dan pengecualian 11px dilaporkan
# terpisah supaya keduanya tidak saling menyamarkan.
MIN_BODY_PX = 12.0

# Mengumpulkan tiap simpul teks yang terlihat beserta ukuran font efektifnya.
# Dikerjakan di dalam peramban, bukan dengan membaca kelas Tailwind, karena
# ukuran akhir baru ada setelah kaskade CSS diselesaikan.
MEASURE = r"""
(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = []
  let node
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim()
    if (!text) continue
    const el = node.parentElement
    if (!el) continue
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    seen.push({
      px: parseFloat(style.fontSize),
      tag: el.tagName.toLowerCase(),
      cls: el.className && el.className.toString().slice(0, 60),
      text: text.slice(0, 40),
    })
  }
  return {
    nodes: seen,
    docHeight: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }
})()
"""


def main() -> int:
    browser = Browser()
    sizes = Counter()
    offenders: list[tuple[str, float, str, str]] = []
    overflow: list[tuple[str, int, int]] = []

    try:
        browser.viewport(*LAPTOP)
        for path, username in SCREENS:
            browser.set_cookie(login(username))
            browser.goto(path)
            m = browser.js(MEASURE)

            for n in m["nodes"]:
                px = round(n["px"], 1)
                sizes[px] += 1
                if px < MIN_BODY_PX:
                    offenders.append((path, px, n["text"], n["cls"]))

            overflow.append((path, m["docHeight"], m["viewport"]))
    finally:
        browser.close()

    print(f"Ukuran font yang benar-benar dirender pada {LAPTOP[0]}x{LAPTOP[1]}:")
    for px in sorted(sizes):
        bar = "#" * min(40, sizes[px] // 4 + 1)
        print(f"  {px:5.1f}px  {sizes[px]:5d}  {bar}")

    print("\nTinggi halaman terhadap viewport:")
    for path, doc, vp in overflow:
        ratio = doc / vp
        print(f"  {path:20s} {doc:5d}px / {vp}px  = {ratio:.2f}x")

    # 06-DESIGN §2.5 assigns 11px ("2xs") to badges and nothing else. Anything
    # else that renders below 12px is drift, not a decision -- which is exactly
    # how the code reached 112 sub-12px nodes with `Th` rendering 11px under a
    # comment that said "§2.5: xs".
    non_badge = [o for o in offenders if "rounded-full" not in o[3]]

    print(f"\nTeks di bawah {MIN_BODY_PX}px: {len(offenders)}")
    print(f"  lencana (sah menurut §2.5)     : {len(offenders) - len(non_badge)}")
    print(f"  BUKAN lencana (pelanggaran)    : {len(non_badge)}")
    for path, px, text, cls in non_badge[:15]:
        print(f"  {path:16s} {px:4.1f}px  {text!r}  [{cls}]")

    if non_badge:
        print("\nGAGAL: teks non-lencana di bawah ambang.")
        return 1

    print("\nOK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
