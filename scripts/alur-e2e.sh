#!/usr/bin/env bash
# Menjalankan alur SIGAP dari awal sampai akhir melalui API yang benar-benar
# berjalan, dan menghitung berapa panggilan yang dibutuhkan tiap peran.
#
# Bukan uji otomatis: ini alat pengukur gesekan. Jumlah langkah per alur adalah
# angka yang dipakai untuk memutuskan apakah sebuah alur terlalu berbelit.
#
# Benar-benar dapat diulang. Alur karyawan membuat kampanye attestation-nya
# sendiri, karena menumpang pada kampanye benih hanya berhasil satu kali:
# pernyataan bersifat sekali seumur tugas, dan jalannya yang kedua melaporkan
# 404 seolah-olah fiturnya rusak.
set -uo pipefail

API=${API:-http://localhost:3001/api/v1}
PASS=${SEED_IDENTITY_PASSWORD:-demo}

STEPS=0
FLOW=""
declare -A FLOW_STEPS

# Semua keterangan ditulis ke stderr. Menulisnya ke stdout membuat keluaran
# status ikut tertangkap saat sebuah pemanggilan dipakai untuk mengambil token,
# dan token yang tercemar gagal dengan galat yang menuduh aplikasi.
hr()   { printf '\n\033[1m%s\033[0m\n' "$1" >&2; printf '%*s\n' 70 '' | tr ' ' '-' >&2; }
flow() { FLOW="$1"; FLOW_STEPS[$FLOW]=0; hr "$1"; }

# Setiap panggilan yang harus dilakukan manusia dihitung satu langkah.
call() {
  local label=$1 method=$2 path=$3 token=${4:-} body=${5:-}
  STEPS=$((STEPS + 1))
  FLOW_STEPS[$FLOW]=$(( ${FLOW_STEPS[$FLOW]} + 1 ))
  local args=(-s -X "$method" "$API$path" -H 'Content-Type: application/json')
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $body ]] && args+=(-d "$body")
  local out code
  out=$(curl "${args[@]}" -w '\n%{http_code}')
  code=$(tail -n1 <<<"$out")
  RESP=$(sed '$d' <<<"$out")
  if [[ $code =~ ^2 ]]; then
    printf '  \033[32mok\033[0m  %-3s %s\n' "$code" "$label" >&2
  else
    printf '  \033[31mNO\033[0m  %-3s %s\n      %s\n' "$code" "$label" \
      "$(python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("detail") or d.get("title") or "")' <<<"$RESP" 2>/dev/null | head -c 160)" >&2
  fi
}

login() {
  call "masuk sebagai $1" POST /auth/login '' "{\"username\":\"$1\",\"password\":\"$PASS\"}"
  python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])' <<<"$RESP" 2>/dev/null
}

jqp()  { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" <<<"$RESP" 2>/dev/null; }
psql() { docker compose exec -T postgres psql -U sigap -d sigap -tAc "$1"; }

SUF=$(date +%H%M%S)

# --------------------------------------------------------------- ALUR KARYAWAN
# Persiapan oleh COMPLIANCE, tidak dihitung sebagai langkah alur karyawan:
# kampanye adalah pekerjaan pengawas, bukan pekerjaan karyawannya.
C=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
      -d "{\"username\":\"hendra.wijaya\",\"password\":\"$PASS\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])')
DOC=$(psql "SELECT id FROM document WHERE document_no='KEB-KEP-001'")
KAMP=$(curl -s -X POST "$API/attestation/kampanye" -H "Authorization: Bearer $C" \
        -H 'Content-Type: application/json' -d "{
          \"name\":\"Attestation Uji Alur $SUF\",
          \"document_ids\":[\"$DOC\"],\"target_kind\":\"SELURUH_KARYAWAN\",
          \"start_date\":\"2026-08-01\",\"due_date\":\"2026-12-31\"}" \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null)
curl -s -X POST "$API/attestation/kampanye/$KAMP/luncurkan" -H "Authorization: Bearer $C" \
     -H 'Content-Type: application/json' -d '{}' >/dev/null

flow "ALUR 1 · Karyawan biasa (Putri) mencari aturan dan menyatakan telah membaca"
T=$(login putri.handayani)
call "cari kebijakan benturan kepentingan" GET "/documents/search?q=benturan%20kepentingan" "$T"
call "buka daftar tugas attestation"        GET /attestation/tugas-saya "$T"
TASK=$(jqp 'd["data"][0]["id"] if d["data"] else ""')
call "buka dokumennya"                      GET "/documents/$DOC" "$T"
call "nyatakan tanpa baca (harus DITOLAK)"  POST "/attestation/tugas/$TASK/nyatakan" "$T" '{"seconds_viewed":2,"reached_end":false}'
call "nyatakan setelah baca"                POST "/attestation/tugas/$TASK/nyatakan" "$T" '{"seconds_viewed":95,"reached_end":true}'

# ------------------------------------------------------------- ALUR REVIEW AKSES
flow "ALUR 2 · Manajer (Fajar) membuka antrean review"
T=$(login fajar.nugroho)
call "buka antrean review saya" GET /my/review-items "$T"

flow "ALUR 3 · Petugas Keamanan (Rina) memantau tiket pencabutan"
T=$(login rina.kusuma)
call "lihat daftar tiket pencabutan" GET /revocation-tickets "$T"

# ------------------------------------------------------------------- ALUR BUKTI
flow "ALUR 4 · Petugas Bukti (Joko) memenuhi permintaan bukti"
T=$(login joko.susilo)
call "buka permintaan bukti saya" GET /my/request-items "$T"

flow "ALUR 5 · Auditor (Sari) menelaah"
T=$(login sari.dewi)
call "buka daftar penugasan" GET /engagements "$T"

# ------------------------------------------------------------------ RINGKASAN
hr "JUMLAH LANGKAH PER ALUR"
for f in "${!FLOW_STEPS[@]}"; do printf '  %-72s %s\n' "$f" "${FLOW_STEPS[$f]}" >&2; done
printf '\n  TOTAL panggilan: %s\n' "$STEPS" >&2
