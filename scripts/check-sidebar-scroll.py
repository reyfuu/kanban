#!/usr/bin/env python3
"""
Ukur perilaku gulir sidebar di peramban sungguhan.

KENAPA ADA. Keluhannya spesifik: "kenapa di sidebar muncul scroll". Membaca
kelas Tailwind tidak menjawabnya -- yang menentukan adalah tinggi konten nyata
terhadap tinggi viewport, dan itu hanya terbaca setelah halaman dirender pada
ukuran layar yang dipakai orangnya. Skrip ini melaporkan angka: scrollHeight,
clientHeight, dan selisihnya, pada beberapa tinggi layar.

Dijalankan manual, sama seperti verify-ui.py:

    ./scripts/dev.sh up && python3 scripts/check-sidebar-scroll.py
"""

import sys
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "verify_ui", Path(__file__).with_name("verify-ui.py")
)
verify_ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_ui)

Browser = verify_ui.Browser
login = verify_ui.login

# Tinggi yang mewakili: laptop pendek (mesin dev ini), laptop biasa, dan layar
# besar. Sidebar hanya boleh menggulir bila memang tidak muat.
#
# 1440x560 sengaja lebih pendek dari layar mana pun yang wajar: ia memaksa
# sidebar menggulir, supaya jalur gulir itu sendiri ikut terukur. Tanpa satu
# ukuran yang meluap, pemeriksaan "scrollbar tipis" tidak pernah dieksekusi
# dan lolos hanya karena tidak ada scrollbar untuk diperiksa.
VIEWPORTS = [(1440, 560), (1440, 700), (1440, 800), (1440, 900), (1920, 1080)]

# Tinggi di mana sidebar boleh menggulir; di bawah ini meluap itu wajar.
MIN_FIT_HEIGHT = 700

# Pengguna dengan izin terluas: sidebar-nya paling panjang, jadi kasus terburuk.
USER = "bayu.pratama"

MEASURE = """
(() => {
  const nav = document.querySelector('aside nav');
  if (!nav) return null;
  const style = getComputedStyle(nav);
  return {
    scrollHeight: nav.scrollHeight,
    clientHeight: nav.clientHeight,
    overflowPx: nav.scrollHeight - nav.clientHeight,
    scrollbarPx: nav.offsetWidth - nav.clientWidth,
    scrollbarWidthProp: style.scrollbarWidth,
    asideHeight: document.querySelector('aside').getBoundingClientRect().height,
    viewport: window.innerHeight,
  };
})()
"""


def main() -> int:
    token = login(USER)
    browser = Browser()
    failures = 0
    try:
        browser.set_cookie(token)
        for width, height in VIEWPORTS:
            browser.viewport(width, height)
            browser.goto("/")
            m = browser.js(MEASURE)
            if m is None:
                print(f"  FAIL  {width}x{height}: sidebar nav tidak ditemukan")
                failures += 1
                continue

            overflow = m["overflowPx"]
            scrolls = overflow > 0
            print(
                f"  {width}x{height}: konten {m['scrollHeight']}px / ruang "
                f"{m['clientHeight']}px → {'GULIR' if scrolls else 'muat'} "
                f"(selisih {overflow}px, scrollbar {m['scrollbarPx']}px, "
                f"scrollbar-width: {m['scrollbarWidthProp']})"
            )

            # Persyaratan 1: pada layar laptop normal sidebar harus muat utuh.
            if height >= MIN_FIT_HEIGHT and scrolls:
                print(f"        FAIL  masih menggulir di tinggi {height}px")
                failures += 1

            # Persyaratan 2: scrollbar tidak boleh memakan lebar panel seperti
            # bawaan OS (~15px). `scrollbar-width: thin` diukur 10px di Chrome
            # dan itulah setipis-tipisnya scrollbar yang masih menyisakan
            # ruang; ambangnya disetel ke situ, bukan ke 0, karena menuntut 0
            # berarti menuntut overlay-scrollbar yang tidak bisa dipaksakan
            # lintas-peramban tanpa menyembunyikan penggulirnya sama sekali.
            if m["scrollbarPx"] > 10:
                print(f"        FAIL  scrollbar memakan {m['scrollbarPx']}px lebar")
                failures += 1

            # Persyaratan 3: bila menggulir, ia harus tipis, bukan bawaan OS.
            if scrolls and m["scrollbarWidthProp"] != "thin":
                print(f"        FAIL  scrollbar-width: {m['scrollbarWidthProp']}")
                failures += 1
            # Persyaratan 4: saat menggulir, item terakhir tetap terjangkau —
            # gulir sampai bawah harus benar-benar sampai. Kalau <nav> kehilangan
            # min-h-0 di dalam flex column, ia melar melewati layar dan bagian
            # bawah (tombol Keluar) jadi tidak bisa dicapai sama sekali.
            if scrolls:
                reached = browser.js(
                    "(() => { const n = document.querySelector('aside nav');"
                    " n.scrollTop = n.scrollHeight;"
                    " return n.scrollTop + n.clientHeight >= n.scrollHeight - 1; })()"
                )
                bottom_visible = browser.js(
                    "(() => { const b = document.querySelector('aside form button');"
                    " const r = b.getBoundingClientRect();"
                    " return r.bottom <= window.innerHeight && r.top >= 0; })()"
                )
                if not reached:
                    print("        FAIL  gulir tidak mencapai dasar daftar")
                    failures += 1
                if not bottom_visible:
                    print("        FAIL  tombol Keluar di luar layar")
                    failures += 1
                else:
                    print("        OK    dasar daftar tercapai, tombol Keluar terlihat")
    finally:
        browser.close()

    print("\nOK" if failures == 0 else f"\n{failures} pemeriksaan gagal")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
