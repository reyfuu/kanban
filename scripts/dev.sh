#!/usr/bin/env bash
#
# Dev process manager for SIGAP — hemat RAM & anti-duplikat.
#
# Kenapa ada: mesin dev RAM-nya terbatas dan tiga proses --watch (api, worker,
# web) gampang dobel lalu bentrok di port (EADDRINUSE). Skrip ini menjaga
# tepat satu instance tiap service, membatasi memori Node, dan memberi satu
# titik start/stop/status/logs.
#
# Pemakaian:
#   ./scripts/dev.sh up            # nyalakan api + worker + web (default)
#   ./scripts/dev.sh up api web    # nyalakan sebagian saja
#   ./scripts/dev.sh down          # matikan semua yang dikelola skrip ini
#   ./scripts/dev.sh restart api   # restart satu service
#   ./scripts/dev.sh status        # tabel status + port + RAM
#   ./scripts/dev.sh logs web      # ikuti log satu service (tail -f)
#
# Catatan hemat RAM:
#   - Kompilasi memakai SWC (`nest start --builder swc`), bukan tsc. Mode watch
#     tsc menahan seluruh program TypeScript di memori dan sendirian memakai
#     ~486MB; SWC mengompilasi per berkas dan tidak menyimpannya. Total proses
#     api turun dari ~712MB ke ~320MB tanpa mengubah kode aplikasi.
#
#     Kenapa bukan tsx/esbuild yang lebih ringan lagi: esbuild tidak memancarkan
#     `emitDecoratorMetadata`, sehingga `design:paramtypes` hilang dan injeksi
#     dependensi NestJS gagal saat runtime — dicoba, dan setiap controller
#     langsung melempar "Cannot read properties of undefined". Alasan yang sama
#     berlaku untuk Bun. SWC memancarkannya, jadi ia satu-satunya jalur cepat
#     yang benar untuk basis kode berdekorator.
#
#   - Worker default TANPA watch (jarang diubah): build sekali lalu jalan dari
#     dist. Set WORKER_WATCH=1 untuk mode watch.
#   - Tiap proses Node dibatasi lewat NODE_OPTIONS=--max-old-space-size.
#     Override dengan API_MEM / WORKER_MEM / WEB_MEM (satuan MB).

# Sengaja tanpa `set -e`: ini process manager interaktif, banyak perintah
# (grep tanpa match, kill proses mati, ps proses hilang) yang "gagal" secara
# normal dan tidak boleh menjatuhkan skrip. Error ditangani eksplisit.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.dev"
mkdir -p "$RUN_DIR"

# Port tiap service (samakan dengan konfigurasi app).
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"

# Batas heap Node (MB). Kecil sengaja: mesin dev RAM terbatas.
API_MEM="${API_MEM:-640}"
WORKER_MEM="${WORKER_MEM:-512}"
WEB_MEM="${WEB_MEM:-1024}"

WORKER_WATCH="${WORKER_WATCH:-0}"

SERVICES=(api worker web)

c_reset='\033[0m'; c_dim='\033[2m'; c_grn='\033[32m'; c_red='\033[31m'; c_ylw='\033[33m'; c_cyn='\033[36m'
say() { printf '%b\n' "$*"; }

pidfile() { echo "$RUN_DIR/$1.pid"; }
logfile() { echo "$RUN_DIR/$1.log"; }

is_running() {
  local svc="$1" pf; pf="$(pidfile "$svc")"
  [[ -f "$pf" ]] || return 1
  local pid; pid="$(cat "$pf" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

port_owner() {
  # PID pemilik port TCP, atau kosong. `|| true` di tiap tahap supaya "port
  # kosong" (grep tak menemukan apa-apa) tidak dianggap error oleh `set -e`.
  ss -ltnpH "sport = :$1" 2>/dev/null | { grep -oE 'pid=[0-9]+' || true; } | head -1 | cut -d= -f2
}

start_cmd() {
  # Perintah shell untuk tiap service, dijalankan dari ROOT.
  case "$1" in
    api)
      echo "NODE_ENV=development NODE_OPTIONS=--max-old-space-size=$API_MEM pnpm --filter @sigap/api start:dev"
      ;;
    worker)
      if [[ "$WORKER_WATCH" == "1" ]]; then
        echo "NODE_ENV=development NODE_OPTIONS=--max-old-space-size=$WORKER_MEM pnpm --filter @sigap/api start:worker"
      else
        # Hemat RAM: build sekali (jika belum ada), lalu jalan dari dist tanpa watcher.
        echo "NODE_ENV=development NODE_OPTIONS=--max-old-space-size=$WORKER_MEM sh -c 'test -f apps/api/dist/worker.js || pnpm --filter @sigap/api build; node apps/api/dist/worker.js'"
      fi
      ;;
    web)
      echo "NODE_OPTIONS=--max-old-space-size=$WEB_MEM WEB_PORT=$WEB_PORT pnpm --filter @sigap/web dev"
      ;;
    *) return 1 ;;
  esac
}

svc_port() { case "$1" in api) echo "$API_PORT";; web) echo "$WEB_PORT";; *) echo "";; esac; }

start_one() {
  local svc="$1"
  if is_running "$svc"; then
    say "${c_ylw}● $svc sudah berjalan${c_reset} (pid $(cat "$(pidfile "$svc")"))"
    return 0
  fi
  # Anti-duplikat: kalau ada proses lain memegang port service ini, tolak.
  local port; port="$(svc_port "$svc")"
  if [[ -n "$port" ]]; then
    local owner; owner="$(port_owner "$port")"
    if [[ -n "$owner" ]]; then
      say "${c_red}✗ $svc tidak dijalankan: port $port sudah dipakai pid $owner${c_reset}"
      say "  ${c_dim}Hentikan dulu: ./scripts/dev.sh down  (atau kill $owner)${c_reset}"
      return 1
    fi
  fi
  local lf; lf="$(logfile "$svc")"
  : > "$lf"
  ( cd "$ROOT" && exec setsid bash -c "$(start_cmd "$svc")" >>"$lf" 2>&1 ) &
  local pid=$!
  echo "$pid" > "$(pidfile "$svc")"
  say "${c_grn}▶ $svc dimulai${c_reset} (pid $pid) ${c_dim}→ .dev/$svc.log${c_reset}"
}

stop_one() {
  local svc="$1" pf; pf="$(pidfile "$svc")"
  if ! is_running "$svc"; then
    rm -f "$pf"
    say "${c_dim}○ $svc tidak berjalan${c_reset}"
    return 0
  fi
  local pid; pid="$(cat "$pf")"
  # Bunuh seluruh process group (setsid) agar watcher & child ikut mati.
  kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$pf"
  say "${c_red}■ $svc dihentikan${c_reset}"
}

rss_mb() { # RAM (MB) satu process group, ringkas.
  local pid="$1"
  [[ -n "$pid" ]] || { echo "-"; return; }
  local kb; kb="$(ps -o rss= --ppid "$pid" -p "$pid" 2>/dev/null | awk '{s+=$1} END{print s}')"
  [[ -n "$kb" && "$kb" -gt 0 ]] && echo "$((kb/1024))" || echo "-"
}

cmd_status() {
  say "${c_cyn}SIGAP dev — status${c_reset}"
  printf '%-8s %-10s %-8s %-8s %s\n' "SERVICE" "STATE" "PID" "RAM(MB)" "PORT"
  for svc in "${SERVICES[@]}"; do
    local state pid ram port
    if is_running "$svc"; then state="running"; pid="$(cat "$(pidfile "$svc")")"; ram="$(rss_mb "$pid")"
    else state="stopped"; pid="-"; ram="-"; fi
    port="$(svc_port "$svc")"; [[ -z "$port" ]] && port="-"
    printf '%-8s %-10s %-8s %-8s %s\n' "$svc" "$state" "$pid" "$ram" "$port"
  done
  say ""
  free -h | awk 'NR==1{print "        "$0} NR==2{print "mem     "$0}'
}

resolve_targets() { # argumen service, default semua
  if [[ $# -eq 0 ]]; then printf '%s\n' "${SERVICES[@]}"; return; fi
  for a in "$@"; do
    case "$a" in api|worker|web) echo "$a";; *) say "${c_red}service tak dikenal: $a${c_reset}" >&2; exit 2;; esac
  done
}

main() {
  local action="${1:-help}"; shift || true
  case "$action" in
    up|start)
      while read -r s; do start_one "$s"; done < <(resolve_targets "$@")
      say ""; say "${c_dim}Pantau: ./scripts/dev.sh status  |  Log: ./scripts/dev.sh logs <svc>${c_reset}"
      ;;
    down|stop)
      # Urutan mundur: web dulu, api terakhir.
      mapfile -t t < <(resolve_targets "$@")
      for ((i=${#t[@]}-1;i>=0;i--)); do stop_one "${t[$i]}"; done
      ;;
    restart)
      mapfile -t t < <(resolve_targets "$@")
      for ((i=${#t[@]}-1;i>=0;i--)); do stop_one "${t[$i]}"; done
      sleep 1
      for s in "${t[@]}"; do start_one "$s"; done
      ;;
    status|st) cmd_status ;;
    logs|log)
      local svc="${1:-}"; [[ -z "$svc" ]] && { say "pakai: dev.sh logs <api|worker|web>"; exit 2; }
      resolve_targets "$svc" >/dev/null
      tail -n 60 -f "$(logfile "$svc")"
      ;;
    help|-h|--help)
      grep -E '^#( |$)' "${BASH_SOURCE[0]}" | sed -E 's/^# ?//'
      ;;
    *) say "${c_red}aksi tak dikenal: $action${c_reset}"; say "coba: up | down | restart | status | logs"; exit 2 ;;
  esac
}

main "$@"
