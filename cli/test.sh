#!/usr/bin/env bash
# CLI smoke + edge-case sweep. Exits non-zero on first failure.
# Authenticates as the owner test user (the API requires a Keycloak token).
set -u
export LEXSTORE_USER="${LEXSTORE_USER:-owner}"
export LEXSTORE_PASS="${LEXSTORE_PASS:-owner}"
CLI="node $(dirname "$0")/lexstore.mjs"
PASS=0; FAIL=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

# expect_exit <expected_code> <description> <command...>
expect_exit() {
  local want=$1; local desc=$2; shift 2
  "$@" >/dev/null 2>&1
  local got=$?
  if [ "$got" -eq "$want" ]; then ok "$desc (exit $got)"; else bad "$desc (want $want, got $got)"; fi
}

echo "== happy paths =="
expect_exit 0 "projects"                        $CLI projects
expect_exit 0 "languages --project mosaic-web"  $CLI languages --project mosaic-web
expect_exit 0 "status --project mosaic-web"     $CLI status --project mosaic-web
expect_exit 0 "pull fr"                         $CLI pull --project mosaic-web --lang fr
expect_exit 0 "help"                            $CLI help

echo "== error paths =="
expect_exit 1 "unknown command"                 $CLI frobnicate
expect_exit 1 "pull missing --project"          $CLI pull --lang fr
expect_exit 1 "pull missing --lang"             $CLI pull --project mosaic-web
expect_exit 1 "unknown project"                 $CLI pull --project does-not-exist --lang fr
expect_exit 1 "unknown language (400 from api)" $CLI pull --project mosaic-web --lang zz
expect_exit 1 "push missing --in"               $CLI push --project mosaic-web --lang fr

echo "== content checks =="
# pull with status filter returns valid JSON
if $CLI pull --project mosaic-web --lang fr --status proofread | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{JSON.parse(s);process.exit(0)})'; then
  ok "pull --status proofread is valid JSON"
else
  bad "pull --status proofread is valid JSON"
fi

# projects output contains the seeded project
if $CLI projects | grep -q "mosaic-web"; then ok "projects lists mosaic-web"; else bad "projects lists mosaic-web"; fi

# push of an unknown key is skipped, not fatal
echo '{"this.key.does.not.exist":"x"}' > /tmp/lexstore-bad.json
if $CLI push --project mosaic-web --lang fr --in /tmp/lexstore-bad.json 2>&1 | grep -q "skip"; then
  ok "push skips unknown keys"
else
  bad "push skips unknown keys"
fi

# ---- API key authentication ----
#
# The key path is what CI actually uses, so it is worth proving rather than
# assuming: a read & write key works, a read-only one is refused the push.
if [ -n "${LEXSTORE_TEST_RW_KEY:-}" ]; then
  if LEXSTORE_USER= LEXSTORE_PASS= LEXSTORE_TOKEN= LEXSTORE_API_KEY="$LEXSTORE_TEST_RW_KEY" \
     $CLI projects | grep -q "mosaic-web"; then
    ok "an API key authenticates without a password"
  else
    bad "an API key authenticates without a password"
  fi
fi

if [ -n "${LEXSTORE_TEST_RO_KEY:-}" ]; then
  echo '{"nav.dashboard":"Nope"}' > /tmp/lexstore-ro.json
  if LEXSTORE_USER= LEXSTORE_PASS= LEXSTORE_TOKEN= LEXSTORE_API_KEY="$LEXSTORE_TEST_RO_KEY" \
     $CLI push --project mosaic-web --lang de --in /tmp/lexstore-ro.json 2>&1 | grep -qi "read-only"; then
    ok "a read-only key is refused the push, and told why"
  else
    bad "a read-only key is refused the push, and told why"
  fi
fi

echo ""
echo "CLI tests: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
