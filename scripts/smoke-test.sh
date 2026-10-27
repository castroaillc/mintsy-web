#!/usr/bin/env bash
# End-to-end auth smoke test against a running backend.
# Usage: scripts/smoke-test.sh http://localhost:8080
# Creates a throwaway user, so don't point it at production.
set -euo pipefail

BASE_URL="${1:?usage: $0 BASE_URL}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
JSON='Content-Type: application/json'

fail() { echo "FAIL: $*" >&2; exit 1; }
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "health"
curl -sf "$BASE_URL/health" | grep -q '"ok"' || fail "/health did not return ok"

echo "sign-up from the app scheme"
code=$(status -c "$JAR" -X POST "$BASE_URL/api/auth/sign-up/email" -H "$JSON" -H "expo-origin: mintsy://" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\",\"name\":\"Smoke Test\"}")
[ "$code" = 200 ] || fail "sign-up returned $code"

echo "GraphQL me with session cookie"
curl -sf -b "$JAR" -X POST "$BASE_URL/graphql" -H "$JSON" -d '{"query":"{ me { email } }"}' \
  | grep -q "$EMAIL" || fail "me query did not return the new user"

echo "GraphQL me without session"
curl -s -X POST "$BASE_URL/graphql" -H "$JSON" -d '{"query":"{ me { email } }"}' \
  | grep -q UNAUTHENTICATED || fail "anonymous me query was not rejected"

echo "untrusted origin rejected"
code=$(status -X POST "$BASE_URL/api/auth/sign-in/email" -H "$JSON" -H "expo-origin: evil://" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\"}")
[ "$code" = 403 ] || fail "untrusted origin returned $code, expected 403"

echo "push token validation"
curl -s -b "$JAR" -X POST "$BASE_URL/graphql" -H "$JSON" \
  -d '{"query":"mutation { registerPushToken(token: \"not-a-token\", platform: \"ios\") }"}' \
  | grep -q BAD_USER_INPUT || fail "invalid push token was accepted"

echo "All smoke tests passed"
