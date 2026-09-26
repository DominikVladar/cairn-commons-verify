#!/usr/bin/env bash
# Job 1 (UNTRUSTED code runs here, no secrets): compile the submission if the static policy passed.
# Writes build-ok.txt; the compiled module ends up in .lake/build/lib/lean/CairnVerify/Submission.*
set -uo pipefail
ok=false
if node -e 'process.exit(JSON.parse(require("fs").readFileSync("policy.json")).scan.ok ? 0 : 1)'; then
  if timeout "${LEAN_BUILD_TIMEOUT:-2400}" lake build CairnVerify.Submission; then ok=true; fi
fi
echo "$ok" > build-ok.txt
echo "build ok: $ok"
