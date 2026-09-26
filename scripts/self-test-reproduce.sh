#!/usr/bin/env bash
# Self-test of the reproduction sandbox: a correct run passes, network access and writes to the code directory
# fail; every allowed image tag must exist.
set -euo pipefail
fail=0
check() { # file expected_stdout want_status
  local want_sha
  want_sha="$(printf '%s' "$2" | sha256sum | cut -d' ' -f1)"
  rm -rf work
  RUN_ID="selftest" ARTIFACT_FILE="$1" FILENAME=main.py IMAGE=python:3.12-slim COMMAND="python main.py" \
    EXPECTED_SHA256="$want_sha" TIMEOUT_SECONDS=60 node scripts/run-reproduction.mjs > /dev/null || true
  local got
  got="$(node -p 'JSON.parse(require("fs").readFileSync("result.json")).status')"
  if [ "$got" = "$3" ]; then echo "ok   $1: $got"; else echo "FAIL $1: got $got, want $3"; fail=1; fi
}
check selftest/reproduce/hello.py "332833500" passed
check selftest/reproduce/network.py "200" failed
check selftest/reproduce/write.py "wrote" failed
for image in $(node -e '
  const s = require("fs").readFileSync("scripts/run-reproduction.mjs", "utf8");
  const m = s.match(/ALLOWED_IMAGES = new Set\(\[([\s\S]*?)\]\)/);
  console.log([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join(" "));'); do
  if docker manifest inspect "$image" > /dev/null 2>&1; then echo "ok   image $image"; else echo "FAIL image $image not found"; fail=1; fi
done
exit $fail
