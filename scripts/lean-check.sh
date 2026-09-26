#!/usr/bin/env bash
# Job 2 (trusted, no secrets). Usage: lean-check.sh <incoming-dir>
#  1. build the trusted inspector and the target module BEFORE any untrusted file is placed;
#  2. verify the source hash and place the untrusted compiled module;
#  3. kernel replay with leanchecker (ships with the toolchain), then the inspector (no initializers run);
#  4. write result.json via evaluate-lean.mjs.
set -euo pipefail
incoming="$1"
: "${THEOREM:=main}"
mkdir -p CairnVerify
lake build cairncheck
if [ -n "${TARGET_B64:-}" ]; then
  node scripts/evaluate-lean.mjs write-target
  lake build CairnVerify.Target
  target_flag="--target"
else
  target_flag=""
fi
if [ -n "${ARTIFACT_SHA256:-}" ]; then
  echo "$ARTIFACT_SHA256  $incoming/CairnVerify/Submission.lean" | sha256sum -c -
fi
mkdir -p CairnVerify .lake/build/lib/lean/CairnVerify
cp "$incoming/CairnVerify/Submission.lean" CairnVerify/Submission.lean
BUILD_OK="$(cat "$incoming/build-ok.txt" 2>/dev/null || echo false)"
if [ "$BUILD_OK" = "true" ]; then
  # Only the submission's compiled files are taken over; everything else stays trusted.
  find "$incoming/.lake/build/lib/lean/CairnVerify" -maxdepth 1 -type f -name 'Submission.*' \
    -exec cp {} .lake/build/lib/lean/CairnVerify/ \;
fi
CHECKER_OK=false
if [ "$BUILD_OK" = "true" ] && timeout "${LEAN_CHECK_TIMEOUT:-2400}" lake env leanchecker CairnVerify.Submission; then
  CHECKER_OK=true
fi
: > inspection.txt
if [ "$CHECKER_OK" = "true" ]; then
  # shellcheck disable=SC2086
  timeout 1200 lake env .lake/build/bin/cairncheck "$THEOREM" $target_flag > inspection.txt || true
  cat inspection.txt
fi
BUILD_OK="$BUILD_OK" CHECKER_OK="$CHECKER_OK" node scripts/evaluate-lean.mjs evaluate
