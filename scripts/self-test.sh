#!/usr/bin/env bash
# Runs every selftest/*.lean through the same scripts as lean.yml (trusted samples, so one job is enough)
# and compares the verdicts with selftest/expected.json.
set -euo pipefail
fail=0
for f in selftest/*.lean; do
  name="$(basename "$f" .lean)"
  rm -rf incoming CairnVerify/Submission.lean CairnVerify/Target.lean .lake/build/lib/lean/CairnVerify
  ARTIFACT_FILE="$f" node scripts/prepare-lean.mjs > /dev/null
  scripts/lean-elaborate.sh
  mkdir -p incoming/CairnVerify incoming/.lake/build/lib/lean/CairnVerify
  cp build-ok.txt incoming/ && cp CairnVerify/Submission.lean incoming/CairnVerify/
  cp .lake/build/lib/lean/CairnVerify/Submission.* incoming/.lake/build/lib/lean/CairnVerify/ 2>/dev/null || true
  rm -rf .lake/build/lib/lean/CairnVerify
  target=""
  if [ -f "selftest/$name.target" ]; then target="$(base64 -w0 "selftest/$name.target")"; fi
  RUN_ID="selftest-$name" ARTIFACT_SHA256="$(sha256sum "$f" | cut -d' ' -f1)" THEOREM=main TARGET_B64="$target" \
    scripts/lean-check.sh incoming > /dev/null
  got="$(node -p 'JSON.parse(require("fs").readFileSync("result.json")).status')"
  want="$(node -p "JSON.parse(require('fs').readFileSync('selftest/expected.json'))['$name']")"
  log="$(node -p 'JSON.parse(require("fs").readFileSync("result.json")).log')"
  if [ "$got" = "$want" ]; then echo "ok   $name: $got ($log)"; else echo "FAIL $name: got $got, want $want ($log)"; fail=1; fi
done
exit $fail
