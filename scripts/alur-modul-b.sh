#!/usr/bin/env bash
# Rantai penuh Modul B, dari kampanye yang dibuat baru.
#
# Kampanye dibuat sendiri, bukan memakai kampanye seed: yang seed sudah selesai
# sampai tiket tertutup, dan menjalankan ulang di atasnya hanya menghasilkan
# 409 berturut-turut yang tidak membuktikan apa pun tentang rantainya.
#
# Setiap panggilan dihitung, karena angka itulah yang dipakai untuk menilai
# apakah alurnya terlalu berbelit bagi manusia yang menjalankannya.
set -uo pipefail
API=${API:-http://localhost:3001/api/v1}
PASS=${SEED_IDENTITY_PASSWORD:-demo}
N=0; SEC_STEPS=0; OWN_STEPS=0

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

say "TAHAP 1 · Petugas Keamanan menyusun kampanye"
SEC=$(login rina.kusuma)
call "lihat aplikasi yang tersedia" GET /applications "$SEC"
APP=$(get 'next(a["id"] for a in d["data"] if a["code"]=="BACKOFFICE")')
call "cari calon reviewer cadangan" GET "/users?q=rina" "$SEC"
FB=$(psql "SELECT id FROM app_user WHERE external_id='rina.kusuma'")
call "buat kampanye" POST /campaigns "$SEC" "$(cat <<JSON
{"name":"Review Ad-hoc Back Office $SUF","campaign_type":"AD_HOC",
 "application_ids":["$APP"],"reviewer_rule":"RA-02",
 "fallback_reviewer_user_id":"$FB",
 "start_date":"2026-08-28","due_date":"2026-09-30"}
JSON
)"
CAMP=$(get 'd["data"]["id"]')
call "lihat pratinjau sebelum meluncurkan" POST "/campaigns/$CAMP/preview" "$SEC" '{}'
note "item: $(get 'd["data"]["item_count"]')  reviewer: $(get 'd["data"]["reviewer_count"]')  dapat diluncurkan: $(get 'd["data"]["can_launch"]')"
note "peringatan: $(get 'chr(59).join(w[chr(34)+"message"+chr(34)] for w in d["data"]["warnings"]) or "tidak ada"')"
call "luncurkan" POST "/campaigns/$CAMP/launch" "$SEC" '{}'
SEC_STEPS=$N

say "TAHAP 2 · Pemilik aplikasi memutuskan"
OWN=$(login dewi.lestari); BEFORE=$N
call "buka antrean" GET "/campaigns/$CAMP/items?status=BELUM_DIPUTUSKAN" "$OWN"
IDS=$(get 'chr(32).join(i["id"] for i in d.get("data",[]))')
note "item yang harus diputuskan: $(wc -w <<<"$IDS")"
FIRST=1
for id in $IDS; do
  if [[ $FIRST == 1 ]]; then
    call "putuskan CABUT (item 1)" POST "/review-items/$id/decision" "$OWN" \
      '{"decision":"CABUT","reason":"Akses tidak lagi diperlukan setelah perubahan penugasan."}'
    FIRST=0
  else
    call "putuskan PERTAHANKAN" POST "/review-items/$id/decision" "$OWN" \
      '{"decision":"PERTAHANKAN","reason":"Masih diperlukan untuk tugas rutin harian."}'
  fi
done

say "TAHAP 3 · Sign-off dan pengamannya"
call "sign-off tanpa autentikasi ulang" POST "/campaigns/$CAMP/signoff" "$OWN" \
  '{"statement":"Saya menyatakan seluruh keputusan review ini benar dan menjadi tanggung jawab saya."}'
[[ $CODE == 401 ]] && note "benar: ditolak, FR-B-015 aturan 2"
call "autentikasi ulang" POST /auth/step-up "$OWN" "{\"password\":\"$PASS\"}"
STEP=$(get 'd["data"]["step_up_token"]')
call "sign-off" POST "/campaigns/$CAMP/signoff" "$OWN" \
  '{"statement":"Saya menyatakan seluruh keputusan review ini benar dan menjadi tanggung jawab saya."}' "$STEP"
OWN_STEPS=$((N - BEFORE))

say "TAHAP 4 · Tiket lahir sendiri"
call "daftar tiket kampanye ini" GET "/revocation-tickets?status=TERBUKA" "$SEC"
TICK=$(psql "SELECT t.id FROM revocation_ticket t JOIN review_decision d ON d.id=t.decision_id
             JOIN review_item i ON i.id=d.review_item_id WHERE i.campaign_id='$CAMP' LIMIT 1")
note "tiket dari kampanye ini: ${TICK:-tidak ada}"
[[ -z $TICK ]] && { note "rantai putus di sini"; exit 1; }
call "buka tiket" GET "/revocation-tickets/$TICK" "$SEC"
note "status: $(get 'd["data"]["status"]')  tenggat: $(get 'd["data"].get("sla_due_date","")')"

say "TAHAP 5 · Pelaksana bekerja, dan tidak bisa menutup sendiri"
call "klaim"          POST "/revocation-tickets/$TICK/claim" "$SEC" '{}'
call "tandai selesai" POST "/revocation-tickets/$TICK/complete" "$SEC" \
  '{"execution_note":"Akses telah dicabut pada aplikasi target melalui konsol admin."}'
call "cek status"     GET  "/revocation-tickets/$TICK" "$SEC"
note "status: $(get 'd["data"]["status"]')  <- klaim pelaksana, belum bukti"

say "TAHAP 6 · Verifikasi menolak klaim selama akses masih terlihat"
call "verifikasi sekarang" POST "/revocation-tickets/$TICK/verify-now" "$SEC" '{}'
call "cek status"          GET  "/revocation-tickets/$TICK" "$SEC"
note "status: $(get 'd["data"]["status"]')"

printf '\n\033[1m  LANGKAH MANUSIA\033[0m\n' >&2
printf '  Petugas Keamanan menyiapkan kampanye : %s panggilan\n' "$SEC_STEPS" >&2
printf '  Pemilik aplikasi memutuskan+sign-off : %s panggilan\n' "$OWN_STEPS" >&2
printf '  Total seluruh rantai                 : %s panggilan\n' "$N" >&2
