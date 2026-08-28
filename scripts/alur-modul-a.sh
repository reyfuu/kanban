#!/usr/bin/env bash
# Rantai penuh Modul A: penugasan → permintaan bukti → saran penggunaan ulang →
# penyerahan → telaah auditor.
#
# Dijalankan dari nol setiap kali, karena permintaan yang sudah ditelaah tidak
# dapat ditelaah ulang, dan menumpang pada data seed hanya menghasilkan 409
# yang tidak membuktikan apa pun tentang rantainya.
set -uo pipefail
API=${API:-http://localhost:3001/api/v1}
PASS=${SEED_IDENTITY_PASSWORD:-demo}
N=0; AUD=0; PIC=0

say()  { printf '\n\033[1m%s\033[0m\n' "$1" >&2; }
note() { printf '        \033[2m%s\033[0m\n' "$1" >&2; }
call() {
  local label=$1 method=$2 path=$3 token=${4:-} body=${5:-} step=${6:-}
  N=$((N+1))
  local args=(-s -X "$method" "$API$path" -H 'Content-Type: application/json')
  [[ -n $token ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n $step  ]] && args+=(-H "X-Step-Up-Token: $step")
  [[ -n $body  ]] && args+=(-d "$body")
  local out; out=$(curl "${args[@]}" -w '\n%{http_code}')
  CODE=$(tail -n1 <<<"$out"); RESP=$(sed '$d' <<<"$out")
  if [[ $CODE =~ ^2 ]]; then printf '  \033[32m%2s ok \033[0m %-3s %s\n' "$N" "$CODE" "$label" >&2
  else printf '  \033[31m%2s NO \033[0m %-3s %s\n        %s\n' "$N" "$CODE" "$label" \
    "$(python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("detail") or "")' <<<"$RESP" 2>/dev/null|head -c 190)" >&2; fi
}
login() { call "masuk $1" POST /auth/login '' "{\"username\":\"$1\",\"password\":\"$PASS\"}"
          python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["access_token"])' <<<"$RESP" 2>/dev/null; }
get()   { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" <<<"$RESP" 2>/dev/null; }
psql()  { docker compose exec -T postgres psql -U sigap -d sigap -tAc "$1"; }

SUF=$(date +%H%M%S)
LEAD=$(psql "SELECT id FROM app_user WHERE external_id='sari.dewi'")
JOKO=$(psql "SELECT e.id FROM employee e WHERE e.employee_number='EMP-00312'")
OPS=$(psql "SELECT id FROM organization_unit WHERE code='OPS'")

say "TAHAP 1 · Auditor membuat penugasan dan meminta bukti"
A=$(login sari.dewi); B0=$N
call "buat penugasan" POST /engagements "$A" "$(cat <<JSON
{"title":"Audit Operasional Semester II $SUF","engagement_type":"AUDIT_INTERNAL",
 "period_covered":{"from":"2026-01-01","to":"2026-06-30"},
 "lead_auditor_id":"$LEAD"}
JSON
)"
ENG=$(get 'd["data"]["id"]')
call "tambah permintaan bukti" POST "/engagements/$ENG/request-items" "$A" "$(cat <<JSON
{"description":"Daftar pengguna aktif aplikasi Back Office per 30 Juni 2026",
 "pic_employee_id":"$JOKO","responsible_org_unit_id":"$OPS",
 "evidence_period":{"from":"2026-01-01","to":"2026-06-30"},
 "due_date":"2026-09-15","is_mandatory":true}
JSON
)"
ITEM=$(get 'd["data"]["id"]')
call "terbitkan ke PIC" POST "/engagements/$ENG/request-items/publish" "$A" '{}'
AUD=$((N - B0))

say "TAHAP 2 · PIC memenuhi permintaan"
P=$(login joko.susilo); B1=$N
call "buka permintaan saya" GET /my/request-items "$P"
note "permintaan menunggu: $(get 'len(d.get("data",[]))')"
call "lihat saran bukti yang sudah ada" GET "/request-items/$ITEM/evidence-suggestions" "$P"
note "saran penggunaan ulang: $(get 'len(d.get("data",[]))')"
# Satu panggilan: mendaftarkan bukti sekaligus menautkannya ke permintaan.
call "daftarkan bukti + tautkan sekaligus" POST /evidence "$P" "$(cat <<JSON
{"title":"Ekspor pengguna Back Office Juni 2026","evidence_type":"LAPORAN_SISTEM",
 "validity_period":{"from":"2026-01-01","to":"2026-06-30"},
 "owner_org_unit_id":"$OPS","classification":"INTERNAL","source":"UNGGAHAN_MANUAL",
 "link":{"target_type":"REQUEST_ITEM","target_id":"$ITEM"}}
JSON
)"
EV=$(get 'd["data"]["id"]')
note "tertaut dalam panggilan yang sama: $(get 'd["data"]["linked"]')"
call "serahkan" POST "/request-items/$ITEM/submit" "$P" '{}'
PIC=$((N - B1))

say "TAHAP 3 · Auditor menelaah"
B2=$N
call "tolak dengan alasan" POST "/request-items/$ITEM/review" "$A" \
  '{"decision":"TOLAK","reason":"Ekspor belum mencakup akun yang dinonaktifkan pada periode tersebut."}'
call "PIC serahkan ulang" POST "/request-items/$ITEM/submit" "$P" '{}'
call "terima" POST "/request-items/$ITEM/review" "$A" '{"decision":"TERIMA"}'
call "lihat kesiapan penugasan" GET "/engagements/$ENG/readiness" "$A"
note "kesiapan: $(get 'd["data"]')"

printf '\n\033[1m  LANGKAH MANUSIA\033[0m\n' >&2
printf '  Auditor menyiapkan permintaan : %s panggilan\n' "$AUD" >&2
printf '  PIC memenuhi                  : %s panggilan\n' "$PIC" >&2
printf '  Telaah + perbaikan            : %s panggilan\n' "$((N - B2))" >&2
printf '  Total                         : %s panggilan\n' "$N" >&2
