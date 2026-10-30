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

echo "GraphQL books without session"
curl -s -X POST "$BASE_URL/graphql" -H "$JSON" -d '{"query":"{ books { id episodes { id locked videoUrl } } }"}' \
  | grep -q '"books":\[' || fail "books query failed"

echo "new user is not premium"
curl -s -b "$JAR" -X POST "$BASE_URL/graphql" -H "$JSON" -d '{"query":"{ me { premium { active willRenew } } }"}' \
  | grep -q '"premium":{"active":false,"willRenew":false}' || fail "me.premium was not inactive for a new user"

echo "RevenueCat webhook rejects a bad Authorization header"
code=$(status -X POST "$BASE_URL/webhooks/revenuecat" -H "$JSON" -H "Authorization: Bearer wrong-$RANDOM" -d '{"event":{}}')
[ "$code" = 401 ] || [ "$code" = 503 ] || fail "webhook with bad auth returned $code, expected 401 (or 503 if unconfigured)"

gql() { curl -s -b "$JAR" -X POST "$BASE_URL/graphql" -H "$JSON" -d "$1"; }

echo "My List: new user has nothing saved"
gql '{"query":"{ me { savedBookIds savedEpisodeIds } }"}' \
  | grep -q '"savedBookIds":\[\],"savedEpisodeIds":\[\]' || fail "new user has saved items"

echo "My List: unknown id rejected"
gql '{"query":"mutation { setSaved(kind: BOOK, id: \"no-such-book-'$RANDOM'\", saved: true) { id } }"}' \
  | grep -q 'Unknown id' || fail "setSaved accepted an unknown book id"

echo "My List: setSaved requires a session"
curl -s -X POST "$BASE_URL/graphql" -H "$JSON" \
  -d '{"query":"mutation { setSaved(kind: BOOK, id: \"x\", saved: false) { id } }"}' \
  | grep -q UNAUTHENTICATED || fail "anonymous setSaved was not rejected"

BOOK_ID=$(curl -s -X POST "$BASE_URL/graphql" -H "$JSON" -d '{"query":"{ books { id } }"}' \
  | sed -n 's/.*"books":\[{"id":"\([^"]*\)".*/\1/p')
if [ -n "$BOOK_ID" ]; then
  echo "My List: save, re-save and remove book $BOOK_ID"
  gql '{"query":"mutation { setSaved(kind: BOOK, id: \"'"$BOOK_ID"'\", saved: true) { savedBookIds } }"}' \
    | grep -q '"savedBookIds":\["'"$BOOK_ID"'"\]' || fail "setSaved did not save the book"
  gql '{"query":"mutation { setSaved(kind: BOOK, id: \"'"$BOOK_ID"'\", saved: true) { savedBookIds } }"}' \
    | grep -q '"savedBookIds":\["'"$BOOK_ID"'"\]' || fail "setSaved is not idempotent"
  gql '{"query":"mutation { setSaved(kind: EPISODE, id: \"'"$BOOK_ID"'-1\", saved: true) { savedEpisodeIds } }"}' \
    | grep -q '"savedEpisodeIds":\["'"$BOOK_ID"'-1"\]' || fail "setSaved did not save the episode"
  gql '{"query":"mutation { setSaved(kind: BOOK, id: \"'"$BOOK_ID"'\", saved: false) { savedBookIds } }"}' \
    | grep -q '"savedBookIds":\[\]' || fail "setSaved did not remove the book"
else
  echo "My List: catalog is empty, skipping save/remove"
fi

echo "Watch progress: setProgress requires a session"
curl -s -X POST "$BASE_URL/graphql" -H "$JSON" \
  -d '{"query":"mutation { setProgress(episodeId: \"x-1\", positionSec: 1) { id } }"}' \
  | grep -q UNAUTHENTICATED || fail "anonymous setProgress was not rejected"

echo "Watch progress: unknown episode rejected"
gql '{"query":"mutation { setProgress(episodeId: \"no-such-book-'$RANDOM'-1\", positionSec: 10) { id } }"}' \
  | grep -q BAD_USER_INPUT || fail "setProgress accepted an unknown episode"

echo "Watch progress: new user has nothing to continue"
gql '{"query":"{ me { continueWatching { id } finishedBookIds } }"}' \
  | grep -q '"continueWatching":\[\],"finishedBookIds":\[\]' || fail "new user has watch progress"

if [ -n "$BOOK_ID" ]; then
  echo "Watch progress: save a position in $BOOK_ID-1, then continue watching"
  gql '{"query":"mutation { setProgress(episodeId: \"'"$BOOK_ID"'-1\", positionSec: 5) { episodeId positionSec completed } }"}' \
    | grep -q '"setProgress":{"episodeId":"'"$BOOK_ID"'-1","positionSec":5,"completed":false}' || fail "setProgress did not save"
  gql '{"query":"{ me { continueWatching(limit: 5) { episodeId positionSec } } }"}' \
    | grep -q '"continueWatching":\[{"episodeId":"'"$BOOK_ID"'-1","positionSec":5}' || fail "continueWatching did not return the episode"
  echo "Watch progress: finishing episode 1 moves continue watching to episode 2 (if published)"
  gql '{"query":"mutation { setProgress(episodeId: \"'"$BOOK_ID"'-1\", positionSec: 999999) { completed } }"}' \
    | grep -q '"completed":true' || fail "a position at the end did not complete the episode"
  gql '{"query":"{ me { continueWatching { episodeId positionSec } finishedBookIds } }"}' \
    | grep -Eq '"continueWatching":\[\{"episodeId":"'"$BOOK_ID"'-2","positionSec":0\}|"finishedBookIds":\["'"$BOOK_ID"'"\]' \
    || fail "continueWatching did not move to the next episode"
else
  echo "Watch progress: catalog is empty, skipping save/continue"
fi

echo "me.premium.store is null for a new user"
gql '{"query":"{ me { premium { store } } }"}' | grep -q '"store":null' || fail "premium.store missing"

echo "web origin: trusted for sign-in and redirect URLs"
code=$(status -X POST "$BASE_URL/api/auth/request-password-reset" -H "$JSON" -H "Origin: https://app.getmintsy.com" \
  -H "X-Forwarded-Host: app.getmintsy.com" \
  -d '{"email":"nobody-'$RANDOM'@example.com","redirectTo":"https://app.getmintsy.com/reset-password"}')
[ "$code" = 200 ] || fail "web redirectTo returned $code, expected 200"
code=$(status -X POST "$BASE_URL/api/auth/sign-in/email" -H "$JSON" -H "Origin: https://evil.example.com" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password1234\"}")
[ "$code" = 403 ] || fail "untrusted web Origin returned $code, expected 403"

echo "list-accounts shows the password account"
curl -s -b "$JAR" "$BASE_URL/api/auth/list-accounts" -H "expo-origin: mintsy://" \
  | grep -q '"providerId":"credential"' || fail "list-accounts did not return the credential account"

echo "social sign-in rejects a garbage ID token (404 when the provider isn't configured)"
# Three calls: Better Auth rate-limits /sign-in/* to 3 per 10 s in production (the CI image)
JWT=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln
for pair in google:garbage google:$JWT apple:$JWT; do
  provider=${pair%%:*}; token=${pair#*:}
  code=$(status -X POST "$BASE_URL/api/auth/sign-in/social" -H "$JSON" -H "expo-origin: mintsy://" \
    -d '{"provider":"'"$provider"'","idToken":{"token":"'"$token"'","nonce":"n"}}')
  [ "$code" = 401 ] || [ "$code" = 404 ] || fail "$provider sign-in with a garbage ID token returned $code"
done

echo "password reset request (unknown email answers the same)"
curl -s -X POST "$BASE_URL/api/auth/request-password-reset" -H "$JSON" -H "expo-origin: mintsy://" \
  -d '{"email":"nobody-'$RANDOM'@example.com","redirectTo":"mintsy://reset-password"}' \
  | grep -q '"status":true' || fail "request-password-reset failed"

echo "password reset rejects an untrusted redirect"
code=$(status -X POST "$BASE_URL/api/auth/request-password-reset" -H "$JSON" \
  -d '{"email":"'"$EMAIL"'","redirectTo":"https://evil.example.com/reset"}')
[ "$code" = 403 ] || fail "untrusted redirectTo returned $code, expected 403"

echo "change password"
code=$(status -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/auth/change-password" -H "$JSON" -H "expo-origin: mintsy://" \
  -d '{"currentPassword":"password1234","newPassword":"password5678","revokeOtherSessions":true}')
[ "$code" = 200 ] || fail "change-password returned $code"

echo "delete account requires a password"
code=$(status -b "$JAR" -X POST "$BASE_URL/api/auth/delete-user" -H "$JSON" -H "expo-origin: mintsy://" -d '{}')
[ "$code" = 400 ] || fail "delete-user without password returned $code, expected 400"
code=$(status -b "$JAR" -X POST "$BASE_URL/api/auth/delete-user" -H "$JSON" -H "expo-origin: mintsy://" \
  -d '{"password":"wrong-password"}')
[ "$code" = 400 ] || fail "delete-user with a wrong password returned $code, expected 400"

echo "delete account"
code=$(status -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/auth/delete-user" -H "$JSON" -H "expo-origin: mintsy://" \
  -d '{"password":"password5678"}')
[ "$code" = 200 ] || fail "delete-user returned $code"
code=$(status -X POST "$BASE_URL/api/auth/sign-in/email" -H "$JSON" -H "expo-origin: mintsy://" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password5678\"}")
[ "$code" = 401 ] || fail "deleted user could still sign in ($code)"

echo "All smoke tests passed"
