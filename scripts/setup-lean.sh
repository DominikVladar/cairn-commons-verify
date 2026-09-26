#!/usr/bin/env bash
# Trusted setup shared by the Lean jobs: pinned toolchain, lakefile, mathlib cache.
set -euo pipefail
source versions.env
if ! [[ "$MATHLIB_REV" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::MATHLIB_REV in versions.env must be a full commit hash."; exit 1
fi
sed -e "s/@MATHLIB_REV@/$MATHLIB_REV/" lakefile.toml.in > lakefile.toml
curl -sSfL "https://raw.githubusercontent.com/leanprover-community/mathlib4/$MATHLIB_REV/lean-toolchain" -o lean-toolchain
if [ ! -x "$HOME/.elan/bin/elan" ]; then
  curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --default-toolchain none
fi
export PATH="$HOME/.elan/bin:$PATH"
if [ -n "${GITHUB_PATH:-}" ]; then echo "$HOME/.elan/bin" >> "$GITHUB_PATH"; fi
lake update
lake exe cache get
