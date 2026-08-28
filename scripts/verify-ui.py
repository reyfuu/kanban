#!/usr/bin/env python3
"""
Verifikasi perilaku antarmuka SIGAP di peramban sungguhan.

KENAPA ADA. Butir audit UI sebelumnya "diverifikasi" dengan grep atas HTML yang
dikirim server. Itu inspeksi, bukan bukti: HTML yang memuat kelas `sm:hidden`
tidak membuktikan tabelnya benar-benar tersembunyi di lebar 375px, dan HTML yang
tidak memuat teks hint tidak membuktikan hint-nya tidak pernah muncul -- hint itu
memang baru dirender setelah pengguna menekan tombol. Dua kesimpulan yang bisa
salah arah, keduanya hanya bisa diselesaikan dengan menjalankan halamannya.

CARA KERJA. Chrome headless dikendalikan lewat DevTools Protocol langsung
(WebSocket + JSON), tanpa Playwright/Puppeteer. Alasannya bukan pemurnian:
menambah dependensi peramban ke repo on-premise ini adalah komitmen perawatan
yang nyata, sementara yang dibutuhkan hanya buka halaman, ubah ukuran viewport,
klik, dan baca DOM. CDP menyediakan keempatnya.

Dijalankan manual (bukan bagian `pnpm test`) karena butuh api+web hidup:

    ./scripts/dev.sh up && python3 scripts/verify-ui.py
"""

import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

import websocket

WEB = "http://localhost:3000"
API = "http://localhost:3001/api/v1"
PHONE = (375, 812)   # iPhone-class, the width the card fallback exists for
DESKTOP = (1440, 900)

results: list[tuple[bool, str, str]] = []


def free_port() -> int:
    """A port nothing else is holding.

    Not hard-coded to 9222: a stray Chrome left from a previous run (or any
    other tool) already listening there makes the new instance bind-fail, and
    the failure surfaces as "Chrome tidak siap" -- which reads like a slow
    start and sends you looking in entirely the wrong place. It cost a
    debugging round while writing this; asking the OS removes the class of
    confusion.
    """
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def check(ok: bool, requirement: str, observed: str) -> None:
    """Record one requirement and what was actually observed for it."""
    results.append((ok, requirement, observed))
    print(f"  {'PASS' if ok else 'FAIL'}  {requirement}\n        → {observed}")


def campaign_in_progress(token: str) -> str:
    """A campaign whose screen offers the reason forms under test."""
    req = urllib.request.Request(
        f"{API}/campaigns", headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        rows = json.load(r)["data"]
    running = next((c for c in rows if c["status"] in ("BERJALAN", "DIPERPANJANG")), None)
    if not running:
        raise RuntimeError("Tidak ada kampanye berjalan untuk menguji form alasan")
    return running["id"]


def login(username: str) -> str:
    body = json.dumps({"username": username, "password": "demo"}).encode()
    req = urllib.request.Request(
        f"{API}/auth/login", data=body, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)["data"]["access_token"]


class Browser:
    def __init__(self) -> None:
        self.port = free_port()
        self.profile = tempfile.mkdtemp(prefix="sigap-ui-verify-")
        self.proc = subprocess.Popen(
            [
                "google-chrome",
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                f"--remote-debugging-port={self.port}",
                f"--user-data-dir={self.profile}",
                # Google service chatter is noise on an offline box and delays
                # the point at which the DevTools endpoint answers.
                "--disable-background-networking",
                "--disable-sync",
                "--no-first-run",
                "--no-default-browser-check",
                # Chrome 111+ rejects a DevTools WebSocket whose Origin header
                # it did not expect, with a 403 at handshake time. The
                # websocket-client library sends one; browsers do not. Without
                # this the connection fails in a way that looks like Chrome
                # never started.
                "--remote-allow-origins=*",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.ws = None
        self.msg_id = 0
        # Chrome's first start on a fresh profile can take a moment before
        # /json answers, so this retries -- but it keeps the last failure.
        # An earlier version swallowed every exception and reported only
        # "Chrome tidak siap", which is a message that describes the symptom
        # and hides the cause; it sent me looking at Chrome flags when the
        # fault was in this file.
        last_error: Exception | None = None
        for _ in range(150):
            try:
                with urllib.request.urlopen(f"http://localhost:{self.port}/json", timeout=1) as r:
                    tabs = json.load(r)
                page = next(
                    t for t in tabs if t["type"] == "page" and t.get("webSocketDebuggerUrl")
                )
                self.ws = websocket.create_connection(
                    page["webSocketDebuggerUrl"], timeout=30
                )
                break
            except Exception as error:  # noqa: BLE001 - reported below
                last_error = error
                if self.proc.poll() is not None:
                    raise RuntimeError(
                        f"Chrome berhenti dengan kode {self.proc.returncode}"
                    ) from error
                time.sleep(0.2)
        if not self.ws:
            raise RuntimeError(
                f"Chrome tidak siap di porta {self.port}: "
                f"{type(last_error).__name__}: {last_error}"
            )
        self.send("Page.enable")
        self.send("Runtime.enable")
        self.send("Network.enable")
        # Headless Chrome treats the page as unfocused, so `:focus` never
        # matches and every focus-revealed element measures as hidden. Without
        # this the skip-link check reports a defect that does not exist -- and,
        # worse, a real regression in the same element would be indistinguishable
        # from the harness artefact.
        self.send("Emulation.setFocusEmulationEnabled", {"enabled": True})

    def send(self, method: str, params: dict | None = None) -> dict:
        self.msg_id += 1
        mid = self.msg_id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                return msg.get("result", {})

    def set_cookie(self, token: str) -> None:
        self.send(
            "Network.setCookie",
            {"name": "sigap_session", "value": token, "domain": "localhost", "path": "/"},
        )

    def viewport(self, width: int, height: int) -> None:
        self.send(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 600},
        )

    def goto(self, path: str) -> None:
        self.send("Page.navigate", {"url": f"{WEB}{path}"})
        # Wait for React to have rendered, not merely for the document to load.
        #
        # Retried once on failure: navigating straight after a cookie change or
        # a viewport change occasionally races the dev server's recompile, and a
        # flaky harness that reports a false defect is worse than no harness --
        # it teaches you to disbelieve real failures.
        for attempt in range(2):
            for _ in range(80):
                time.sleep(0.25)
                try:
                    state = self.js("document.readyState")
                    ready = self.js("!!document.querySelector('main')")
                except RuntimeError:
                    continue
                if state == "complete" and ready:
                    time.sleep(0.4)
                    return
            if attempt == 0:
                self.send("Page.navigate", {"url": f"{WEB}{path}"})
        raise RuntimeError(f"Halaman {path} tidak selesai memuat")

    def js(self, expression: str):
        res = self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in res:
            raise RuntimeError(res["exceptionDetails"].get("text", "JS error"))
        return res.get("result", {}).get("value")

    def close(self) -> None:
        try:
            if self.ws:
                self.ws.close()
        finally:
            self.proc.terminate()


# Helpers evaluated in the page, so every assertion is about rendered geometry
# rather than about markup.
VISIBLE = """
(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
}
"""


def main() -> int:
    tokens = {u: login(u) for u in ("rina.kusuma", "dewi.lestari", "bayu.pratama", "sari.dewi")}
    b = Browser()
    try:
        print("\n[P0] Target sentuh >= 44px pada lebar ponsel")
        b.set_cookie(tokens["rina.kusuma"])
        b.viewport(*PHONE)
        for path in ("/tiket", "/aplikasi", "/"):
            b.goto(path)
            small = b.js(
                """
                (() => {
                  const bad = [];
                  for (const el of document.querySelectorAll('a[href], button, select, input:not([type=hidden]), textarea')) {
                    const r = el.getBoundingClientRect();
                    const s = getComputedStyle(el);
                    if (r.width === 0 || r.height === 0) continue;
                    if (s.display === 'none' || s.visibility === 'hidden') continue;
                    if (el.closest('[hidden]')) continue;
                    // Skip inline text links inside a paragraph: WCAG 2.5.8
                    // exempts targets inline in a sentence, and forcing them to
                    // 44px would wreck body copy.
                    if (el.tagName === 'A' && el.closest('p')) continue;
                    // The skip-link is deliberately 1px until focused; that is
                    // what makes it invisible to sighted users. Measuring it
                    // unfocused is measuring the wrong state, and it is checked
                    // properly in the a11y section below.
                    if (el.getAttribute('href') === '#konten-utama') continue;
                    if (r.height < 44) bad.push((el.tagName + ' ' + (el.textContent||'').trim().slice(0,28)).trim() + ' h=' + Math.round(r.height));
                  }
                  return bad;
                })()
                """
            )
            check(
                len(small) == 0,
                f"P0 · semua kendali di {path} tingginya >= 44px (375px)",
                "semua memenuhi" if not small else f"{len(small)} terlalu kecil: {small[:4]}",
            )

        print("\n[P1 #7] Tabel diganti kartu di layar sempit, kembali jadi tabel di desktop")
        for path, token in (("/aplikasi", "rina.kusuma"), ("/tiket", "rina.kusuma"), ("/jejak-audit", "bayu.pratama")):
            b.set_cookie(tokens[token])
            b.viewport(*PHONE)
            b.goto(path)
            table_phone = b.js(f"({VISIBLE})('table')")
            no_hscroll = b.js("document.documentElement.scrollWidth <= window.innerWidth + 1")
            b.viewport(*DESKTOP)
            b.goto(path)
            table_desktop = b.js(f"({VISIBLE})('table')")
            check(
                table_phone is False and table_desktop is True,
                f"P1#7 · {path}: tabel tersembunyi di 375px, tampil di 1440px",
                f"tabel@375={table_phone}, tabel@1440={table_desktop}",
            )
            check(
                no_hscroll is True,
                f"P1#7 · {path}: tidak ada gulir horizontal di 375px",
                f"scrollWidth<=innerWidth: {no_hscroll}",
            )

        print("\n[P1 #6] Validasi hidup muncul setelah form dibuka (bukan tombol mati diam-diam)")
        # Driven on the campaign screen rather than tickets: the seeded tickets
        # have already moved past the states that offer a reason form, and a
        # check that silently finds no form to open would pass by doing nothing.
        # Both screens use the same ReasonHint component, so this exercises the
        # shared rule.
        b.set_cookie(tokens["rina.kusuma"])
        b.viewport(*DESKTOP)
        campaign_id = campaign_in_progress(tokens["rina.kusuma"])
        b.goto(f"/kampanye/{campaign_id}")
        opened = b.js(
            """
            (() => {
              const btn = [...document.querySelectorAll('button')]
                .find(b => /^Perpanjang$|^Batalkan$/.test((b.textContent||'').trim()));
              if (!btn) return 'tidak ada tombol yang membuka form alasan';
              btn.click();
              return 'ok';
            })()
            """
        )
        time.sleep(0.6)
        has_form = b.js("!!document.querySelector('form textarea')")
        hint = b.js(
            "(() => { const p = [...document.querySelectorAll('[aria-live=polite]')]"
            ".map(e => e.textContent || ''); return p.find(t => /minimal/.test(t)) || null; })()"
        )
        check(
            opened == "ok" and has_form is True and hint is not None,
            "P1#6 · hint validasi terlihat saat form terbuka, dengan aria-live",
            f"form terbuka={opened}, textarea={has_form}, hint={hint!r}",
        )

        def type_reason(text: str) -> None:
            """Set the textarea the way React sees it.

            Assigning `.value` directly does not notify React, because React
            installs its own value setter on the prototype; calling the native
            descriptor and then dispatching `input` is what makes the component
            re-render. Getting this wrong produces a check that types nothing
            and then reports the hint never updated.
            """
            b.js(
                """
                (() => {
                  const ta = document.querySelector('form textarea');
                  if (!ta) return false;
                  const proto = Object.getPrototypeOf(ta);
                  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
                  setter.call(ta, %s);
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                  return true;
                })()
                """
                % json.dumps(text)
            )
            time.sleep(0.5)

        type_reason("kurang")
        hint_short = b.js(
            "(() => { const p = [...document.querySelectorAll('[aria-live=polite]')]"
            ".map(e => e.textContent || ''); return p.find(t => /kurang \\d/.test(t)) || null; })()"
        )
        check(
            hint_short is not None,
            "P1#6 · hint menghitung sisa karakter saat mengetik",
            f"hint={hint_short!r}",
        )

        blocked = b.js(
            """
            (() => {
              const btns = [...document.querySelectorAll('form button[type=submit]')];
              return btns.length ? btns.some(b => b.disabled) : null;
            })()
            """
        )
        check(
            blocked is True,
            "P1#6 · tombol kirim masih terkunci selagi alasan kurang",
            f"ada submit disabled={blocked}",
        )

        type_reason("kampanye diperpanjang karena data akses terlambat")
        enabled = b.js(
            """
            (() => {
              const btns = [...document.querySelectorAll('form button[type=submit]')];
              return btns.length ? btns.every(b => !b.disabled) : null;
            })()
            """
        )
        hint_ok = b.js(
            "(() => { const p = [...document.querySelectorAll('[aria-live=polite]')]"
            ".map(e => e.textContent || ''); return p.find(t => /memenuhi syarat/.test(t)) || null; })()"
        )
        check(
            enabled is True and hint_ok is not None,
            "P1#6 · tombol aktif dan hint mengonfirmasi setelah alasan cukup",
            f"submit aktif={enabled}, hint={hint_ok!r}",
        )

        print("\n[P1 #5] Kartu keputusan naik ke atas lipatan di layar review")
        b.set_cookie(tokens["dewi.lestari"])
        b.viewport(*DESKTOP)
        b.goto("/review")
        geometry = b.js(
            """
            (() => {
              const details = document.querySelector('details');
              const first = document.querySelector('fieldset, [role=progressbar]');
              const cards = document.querySelectorAll('fieldset');
              const firstCard = cards[0];
              return {
                introCollapsed: details ? !details.open : null,
                firstCardTop: firstCard ? Math.round(firstCard.getBoundingClientRect().top) : null,
                viewport: window.innerHeight,
              };
            })()
            """
        )
        top = geometry.get("firstCardTop")
        check(
            geometry.get("introCollapsed") is True,
            "P1#5 · paragraf pengantar terlipat secara bawaan",
            f"details tertutup={geometry.get('introCollapsed')}",
        )
        check(
            top is not None and top < geometry["viewport"],
            "P1#5 · kendali keputusan pertama berada di atas lipatan",
            f"posisi kartu pertama={top}px, tinggi viewport={geometry['viewport']}px",
        )

        print("\n[P1 a11y] Skip-link, focus trap, dan Escape pada navigasi ponsel")
        b.set_cookie(tokens["rina.kusuma"])
        b.viewport(*DESKTOP)
        b.goto("/")
        skip = b.js(
            """
            (() => {
              const a = document.querySelector('a[href="#konten-utama"]');
              if (!a) return { found: false };
              a.focus();
              const r = a.getBoundingClientRect();
              // Measured, not inferred from class names: the first version of
              // this link carried a `focus:not-sr-only` class that emitted no
              // CSS at all, so it read as correct in the markup while staying
              // 1x1 pixels on screen.
              return {
                found: true,
                matchesFocus: a.matches(':focus'),
                width: Math.round(r.width),
                height: Math.round(r.height),
                onScreen: r.top >= 0 && r.left >= 0,
                target: !!document.querySelector('#konten-utama'),
              };
            })()
            """
        )
        check(
            bool(skip.get("found"))
            and bool(skip.get("target"))
            and bool(skip.get("onScreen"))
            # A real target, not a 1px placeholder: 44px tall and wide enough to
            # read.
            and skip.get("height", 0) >= 44
            and skip.get("width", 0) >= 100,
            "a11y · skip-link benar-benar terlihat saat difokus, dan targetnya ada",
            f"{skip}",
        )

        b.viewport(*PHONE)
        b.goto("/")
        b.js(
            """
            (() => {
              const btn = [...document.querySelectorAll('button')]
                .find(b => (b.getAttribute('aria-label')||'') === 'Buka navigasi');
              btn && btn.click();
            })()
            """
        )
        time.sleep(0.5)
        focus_moved = b.js(
            "(() => { const p = document.querySelector('aside');"
            " return !!p && p.contains(document.activeElement); })()"
        )
        check(
            focus_moved is True,
            "a11y · fokus berpindah ke dalam panel saat navigasi dibuka",
            f"activeElement di dalam aside={focus_moved}",
        )

        b.send(
            "Input.dispatchKeyEvent",
            {"type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27},
        )
        b.send(
            "Input.dispatchKeyEvent",
            {"type": "keyUp", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27},
        )
        time.sleep(0.5)
        closed = b.js(
            "(() => { const a = document.querySelector('aside');"
            " return !!a && a.className.includes('-translate-x-full'); })()"
        )
        check(
            closed is True,
            "a11y · Escape menutup slide-over navigasi",
            f"panel tertutup={closed}",
        )

        print("\n[P0] Batas error: kegagalan API tidak menampilkan layar Inggris bawaan Next")
        b.viewport(*DESKTOP)
        b.goto("/kebijakan/00000000-0000-0000-0000-000000000000")
        notfound = b.js(
            "(() => ({ id: /Halaman tidak ditemukan/.test(document.body.innerText),"
            " en: /could not be found/i.test(document.body.innerText) }))()"
        )
        check(
            notfound["id"] is True and notfound["en"] is False,
            "P0 · 404 dalam Bahasa Indonesia, tanpa teks bawaan Next",
            f"{notfound}",
        )

        print("\n[FR-C-010] Kebocoran hak akses tidak terlihat di antarmuka")
        b.set_cookie(tokens["sari.dewi"])
        b.goto("/kebijakan?q=aksi+korporasi")
        leak = b.js(
            "(() => ({ mentions: /Aksi Korporasi/i.test(document.body.innerText),"
            " text: document.body.innerText.slice(0, 0) }))()"
        )
        check(
            leak["mentions"] is False,
            "FR-C-010 · dokumen RAHASIA tidak muncul di layar pencarian bagi non-pemilik",
            f"disebut di halaman={leak['mentions']}",
        )

        print("\n[FR-C-020] Gerbang baca attestation di peramban")
        b.set_cookie(tokens["sari.dewi"])
        b.goto("/attestation")
        link = b.js(
            "(() => { const a = [...document.querySelectorAll('a')]"
            ".find(a => /Buka dan baca dokumen/.test(a.textContent||''));"
            " return a ? a.getAttribute('href') : null; })()"
        )
        if link:
            b.goto(link)
            initial = b.js(
                "(() => { const b = [...document.querySelectorAll('button')]"
                ".find(b => /Saya telah membaca/.test(b.textContent||''));"
                " return b ? b.disabled : null; })()"
            )
            check(
                initial is True,
                "FR-C-020 · tombol pernyataan nonaktif saat dokumen baru dibuka",
                f"disabled={initial}",
            )
            hint_gate = b.js(
                "(() => { const p = [...document.querySelectorAll('[aria-live=polite]')]"
                ".map(e => e.textContent||''); return p.find(t => /Gulir|detik/.test(t)) || null; })()"
            )
            check(
                hint_gate is not None,
                "FR-C-020 · pengguna diberi tahu apa yang masih kurang, bukan tombol mati diam",
                f"pesan={hint_gate!r}",
            )

            # Wait out the dwell timer, then scroll to the end, and confirm the
            # gate actually opens. Asserting only that the button starts
            # disabled would pass equally well for a button that never enables
            # -- which would make the obligation impossible to discharge.
            time.sleep(6.5)
            b.js("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.5)
            after_gate = b.js(
                "(() => { const b = [...document.querySelectorAll('button')]"
                ".find(b => /Saya telah membaca/.test(b.textContent||''));"
                " return b ? { disabled: b.disabled, h: Math.round(b.getBoundingClientRect().height) } : null; })()"
            )
            check(
                after_gate is not None and after_gate["disabled"] is False,
                "FR-C-020 · tombol terbuka setelah dibaca dan digulir sampai akhir",
                f"{after_gate}",
            )
            check(
                after_gate is not None and after_gate.get("h", 0) >= 44,
                "FR-C-020 · tombol pernyataan memenuhi target sentuh 44px",
                f"tinggi={after_gate.get('h') if after_gate else None}px",
            )
        else:
            check(False, "FR-C-020 · gerbang baca", "tidak ada tugas attestation aktif untuk diuji")

        print("\n" + "=" * 70)
        passed = sum(1 for ok, _, _ in results if ok)
        print(f"HASIL: {passed}/{len(results)} pemeriksaan lulus")
        for ok, req, obs in results:
            if not ok:
                print(f"  GAGAL: {req} → {obs}")
        return 0 if passed == len(results) else 1
    finally:
        b.close()


if __name__ == "__main__":
    sys.exit(main())
