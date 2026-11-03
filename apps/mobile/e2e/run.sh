#!/usr/bin/env bash
# mintsy MVP end-to-end suite (Maestro). See e2e/README.md for bringing up the isolated stack.
# Usage: e2e/run.sh [flow-prefix ...]   e.g. e2e/run.sh 01 02   (default: all scenarios in order)
set -uo pipefail

# ── Configuration (override with environment variables) ─────────────────────────
UDID="${UDID:-192FD249-EC91-44C2-9D74-89D8DEACB85C}"          # booted simulator
APP_ID="${APP_ID:-com.getmintsy.app.dev}"
SCHEME="${SCHEME:-mintsy-dev}"
METRO_URL="${METRO_URL:-http://localhost:8082}"               # started with EXPO_PUBLIC_API_URL=$API_URL
API_URL="${API_URL:-http://localhost:4318}"                   # backend on the e2e database
ADMIN_URL="${ADMIN_URL:-http://127.0.0.1:3100}"               # admin (scratch copy) + dry-run studio worker
# Backend stdout: without RESEND_API_KEY it prints email links (password reset) there
BACKEND_LOG="${BACKEND_LOG:-/private/tmp/claude-501/-Users-steve-Desktop-Software-mobile-app/23d3fecf-75fb-4753-bcca-fe304af089c9/scratchpad/e2e/backend.log}"
REVENUECAT_WEBHOOK_AUTH="${REVENUECAT_WEBHOOK_AUTH:-Bearer e2e}"
MONGO_CONTAINER="${MONGO_CONTAINER:-backend-mongo-1}"
MONGO_DB="${MONGO_DB:-mintsy-e2e}"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1

# ── Per-run values ──────────────────────────────────────────────────────────────
HERE="$(cd "$(dirname "$0")" && pwd)"
FLOWS="$HERE/flows"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
# Reuse an earlier run's account with STAMP=<its timestamp> when rerunning single flows after 01
STAMP="${STAMP:-$(date +%s)}"
OUT="$HERE/artifacts/$RUN_ID"
EMAIL="e2e+$STAMP@mintsy.test"
PASSWORD="Passw0rd-one-$STAMP"
PASSWORD2="Passw0rd-two-$STAMP"
PASSWORD3="Passw0rd-three-$STAMP"
CURRENT_PASSWORD="$PASSWORD"
NEW_BOOK_ID="e2e-$STAMP"
NEW_TITLE=""
METRO_URL_ENC="$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$METRO_URL")"
mkdir -p "$OUT"
RESULTS="$OUT/results.txt"
: > "$RESULTS"

log() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
record() { printf '%-28s %s\n' "$1" "$2" | tee -a "$RESULTS"; }

SELECTED="$*"   # flow prefixes from the command line; empty runs everything
want() { # want <flow name>: true when the flow was selected (or nothing was)
  [ -z "$SELECTED" ] && return 0
  local s
  for s in $SELECTED; do case "$1" in "$s"*) return 0 ;; esac; done
  return 1
}

flow() { # flow <file> [-e K=V ...]
  local file="$1"; shift
  local name="${file%.yaml}"
  want "$name" || return 0
  log "$name"
  if "$MAESTRO" --device "$UDID" test \
      --test-output-dir "$OUT/$name" \
      -e METRO_URL_ENC="$METRO_URL_ENC" -e EMAIL="$EMAIL" \
      -e PASSWORD="$PASSWORD" -e PASSWORD2="$PASSWORD2" -e PASSWORD3="$PASSWORD3" \
      -e CURRENT_PASSWORD="$CURRENT_PASSWORD" \
      "$@" "$FLOWS/$file" 2>&1 | tee "$OUT/$name.log"; then
    record "$name" PASS
    # The account's password after the password flows (08c deletes with it)
    case "$name" in 08a-*) CURRENT_PASSWORD="$PASSWORD2" ;; 08b-*) CURRENT_PASSWORD="$PASSWORD3" ;; esac
  else
    record "$name" FAIL
  fi
  # Collect screenshots in one folder
  find "$OUT/$name" -name '*.png' -exec cp {} "$OUT/" \; 2>/dev/null
}

admin_json() { curl -sS -X POST "$ADMIN_URL$1" -H 'content-type: application/json' -d "$2"; }

wait_job() { # wait_job <bookId> <kind>: polls the admin jobs API until the job finishes
  local status=none
  for _ in $(seq 1 150); do
    status="$(curl -sS "$ADMIN_URL/api/jobs?bookId=$1" | python3 "$HERE/lib/job_status.py" "$2")"
    case "$status" in
      succeeded) return 0 ;;
      failed) echo "$2 job failed"; return 1 ;;
    esac
    sleep 2
  done
  echo "$2 job timed out ($status)"; return 1
}

publish_book() { # Scenario 6, non-UI half: create, script, render and publish a one-episode book
  log "publish $NEW_BOOK_ID via admin API"
  local pdf="$OUT/tiny.pdf"
  printf '%%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%%%EOF\n' > "$pdf"
  curl -sS -X POST "$ADMIN_URL/api/books" -F "bookId=$NEW_BOOK_ID" -F "pdf=@$pdf;type=application/pdf" && echo
  wait_job "$NEW_BOOK_ID" ingest || return 1
  admin_json "/api/books/$NEW_BOOK_ID/jobs" '{"kind":"script","chapter":1}' && echo
  wait_job "$NEW_BOOK_ID" script || return 1
  admin_json "/api/books/$NEW_BOOK_ID/jobs" '{"kind":"render","chapter":1}' && echo
  wait_job "$NEW_BOOK_ID" render || return 1
  admin_json "/api/books/$NEW_BOOK_ID/episodes/1/status" '{"status":"published"}' && echo
  admin_json "/api/books/$NEW_BOOK_ID/status" '{"status":"published"}' && echo
  NEW_TITLE="$(curl -sS "$API_URL/graphql" -H 'content-type: application/json' \
    -d '{"query":"{ books { id title } }"}' | python3 "$HERE/lib/book_title.py" "$NEW_BOOK_ID")" || return 1
  echo "published: $NEW_TITLE"
}

user_id() {
  local js="const u = db.user.findOne({ email: '$EMAIL' }); print(u ? u._id.toString() : '')"
  docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "$js"
}

send_purchase_webhook() { # Scenario 7, non-UI half
  local uid now
  uid="$(user_id)"
  [ -n "$uid" ] || { echo "no user for $EMAIL"; return 1; }
  now="$(python3 -c 'import time;print(int(time.time()*1000))')"
  log "INITIAL_PURCHASE webhook for $uid"
  curl -sS -X POST "$API_URL/webhooks/revenuecat" -H "Authorization: $REVENUECAT_WEBHOOK_AUTH" \
    -H 'content-type: application/json' -d "{\"api_version\":\"1.0\",\"event\":{
      \"id\":\"e2e-$STAMP\",\"type\":\"INITIAL_PURCHASE\",\"app_user_id\":\"$uid\",
      \"entitlement_ids\":[\"premium\"],\"product_id\":\"mintsy_premium_yearly\",\"period_type\":\"TRIAL\",
      \"purchased_at_ms\":$now,\"expiration_at_ms\":$((now + 7*24*3600*1000)),\"event_timestamp_ms\":$now,
      \"store\":\"APP_STORE\",\"environment\":\"SANDBOX\"}}" -w ' HTTP %{http_code}\n'
}

reset_url() { # The newest reset link for $EMAIL in the backend log, resolved to the app link it redirects to
  local link
  link="$(grep -A3 "to=$EMAIL" "$BACKEND_LOG" | grep -o 'link: http[^ ]*reset-password[^ ]*' | tail -1 | sed 's/^link: //')"
  [ -n "$link" ] || return 1
  curl -sS -o /dev/null -w '%{redirect_url}' "$link"
}

# ── Preflight ───────────────────────────────────────────────────────────────────
log "run $RUN_ID · $EMAIL · artifacts in $OUT"
curl -sSf -o /dev/null "$METRO_URL/status" || { echo "Metro isn't up at $METRO_URL"; exit 2; }
curl -sS -o /dev/null "$API_URL/graphql" || { echo "Backend isn't up at $API_URL"; exit 2; }
curl -sSf -o /dev/null "$ADMIN_URL/" || { echo "Admin isn't up at $ADMIN_URL"; exit 2; }
xcrun simctl list devices booted | grep -q "$UDID" || { echo "Simulator $UDID isn't booted"; exit 2; }

# ── Scenarios ───────────────────────────────────────────────────────────────────
flow 01-signup-onboarding.yaml
flow 02-catalog-series.yaml
flow 03-play-episode.yaml
flow 04-paywall-locked.yaml
flow 05-my-list.yaml
if want 06; then
  if publish_book; then flow 06-new-content.yaml -e NEW_TITLE="$NEW_TITLE"
  else record 06-new-content "FAIL (admin publish)"; fi
fi
if want 07; then
  if send_purchase_webhook; then flow 07-premium.yaml
  else record 07-premium "FAIL (webhook)"; fi
fi
flow 08a-change-password.yaml
if want 08b; then
  url=""
  for _ in $(seq 1 15); do url="$(reset_url)" && [ -n "$url" ] && break; sleep 2; done
  if [ -n "$url" ]; then echo "reset link → $url"; flow 08b-reset-password.yaml -e RESET_URL="$url"
  else record 08b-reset-password "FAIL (no reset link for $EMAIL in $BACKEND_LOG)"; fi
fi
flow 08c-delete-account.yaml

log "Results ($OUT)"
cat "$RESULTS"
! grep -q FAIL "$RESULTS"
