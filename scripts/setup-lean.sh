#!/usr/bin/env bash
# Trusted setup shared by the Lean jobs: pinned toolchain, lakefile, mathlib cache.
set -euo pipefail
source versions.env
if ! [[ "$MATHLIB_REV" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::MATHLIB_REV in versions.env must be a full commit hash."; exit 1
fi
if ! [[ "${FC_REV:-}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::FC_REV in versions.env must be a full commit hash."; exit 1
fi
# Formal Conjectures must be built against the same Mathlib as everything else.
fc_mathlib="$(curl -sSfL "https://raw.githubusercontent.com/google-deepmind/formal-conjectures/$FC_REV/lake-manifest.json" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).packages.find(p=>p.name==="mathlib");process.stdout.write(m?m.rev:"")})')"
if [ "$fc_mathlib" != "$MATHLIB_REV" ]; then
  echo "::error::Formal Conjectures $FC_REV pins Mathlib $fc_mathlib, but MATHLIB_REV is $MATHLIB_REV."; exit 1
fi
sed -e "s/@MATHLIB_REV@/$MATHLIB_REV/" -e "s/@FC_REV@/$FC_REV/" lakefile.toml.in > lakefile.toml
curl -sSfL "https://raw.githubusercontent.com/leanprover-community/mathlib4/$MATHLIB_REV/lean-toolchain" -o lean-toolchain
if [ ! -x "$HOME/.elan/bin/elan" ]; then
  curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --default-toolchain none
fi
export PATH="$HOME/.elan/bin:$PATH"
if [ -n "${GITHUB_PATH:-}" ]; then echo "$HOME/.elan/bin" >> "$GITHUB_PATH"; fi
lake update
lake exe cache get
