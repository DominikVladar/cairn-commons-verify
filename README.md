# cairn-commons-verify

Public verification runners for [Cairn Commons](https://github.com/DominikVladar/cairn-commons). Untrusted code
never runs on the platform's server. It runs here in GitHub Actions, which is free for public repositories.
This repository is generated from the `verify/` directory of the main repository. Change it there and copy it
over.

| Workflow | What it checks |
|---|---|
| `lean.yml` | A claim's Lean 4 + mathlib file. Checks: static policy (no `sorry`, new axioms, `#eval`, macros/elaborators, `initialize`, `IO`, `native_decide`, only Mathlib-family imports), compilation, **kernel replay** with `leanchecker`, axioms ⊆ {propext, Classical.choice, Quot.sound}, the theorem is declared in the submitted file, and optionally that its type is definitionally equal (kernel) to the problem's pinned target statement. |
| `reproduce.yml` | Re-runs submitted code in Docker and compares its stdout with the claimed output (SHA-256). |
| `self-test.yml` | Runs known-good and known-bad samples (`selftest/`) through the same scripts. It is also the only workflow that writes the toolchain/mathlib cache. |

## Isolation

**Lean, job `elaborate`** (untrusted, no secrets, `contents: read`)
- Compiles the submission. Elaboration can execute code if the static policy is ever bypassed.
- Only `Submission.*` build outputs and a `build-ok` flag leave this job.

**Lean, job `check`** (fresh VM, no secrets)
- First builds the trusted inspector `CairnCheck.lean` and the target module `CairnVerify/Target.lean`, before
  any untrusted file exists.
- Then verifies the source hash and re-runs the static policy.
- Replays the untrusted `.olean` through the kernel with `leanchecker`.
- Queries axioms, the declaring module and the target match with the inspector.
- The inspector uses `importModules` **without enabling initializers**. `lake env lean Check.lean` would run the
  `initialize` blocks of the imported submission, so this repository deliberately does not use it.

**Lean, job `report`**
- The only job with the webhook secret.
- Reads `result.json`, validates it strictly, signs it with HMAC and posts it.

**Reproduction sandbox**
- `--network none`, read-only root, read-only code mount.
- Non-root user, no capabilities, `no-new-privileges`.
- 2 GB RAM, 2 CPUs, 256 pids, wall-clock timeout.
- Images come from a fixed allowlist.

**Cache**
- `lean.yml` only *restores* caches. `self-test.yml` alone saves them, so a submission cannot poison the
  mathlib build used by later runs.

**Residual risk**
- A hand-crafted `.olean` from a compromised `elaborate` job is still parsed by `leanchecker` and the inspector.
- Olean loading is not hardened against malicious files. The static policy and the separate jobs are the main
  defence.

## Pinned versions

`versions.env` pins mathlib by commit (`MATHLIB_REV`, tag in `MATHLIB_TAG`). Mathlib's `lean-toolchain` at that
commit decides the Lean version. `leanchecker` ships with every Lean toolchain since v4.28 and replaces the
archived lean4checker repository. To upgrade:
1. Change both lines.
2. Push.
3. Check that `self-test.yml` is green.

The reproduction images are listed in `scripts/run-reproduction.mjs`. Keep them in sync with
`verification.reproductionImages` in the main repository. The self-test checks that every tag exists.

## Setup

1. Settings → Environments → create an environment named `report`:
   - Add the secret `CAIRN_WEBHOOK_SECRET`, a random string such as the output of `openssl rand -hex 32`. Use the
     same value as the Worker secret `VERIFY_WEBHOOK_SECRET`.
   - Optionally restrict deployment to the `main` branch.
2. Settings → Variables → Actions → add the repository variable `CAIRN_CALLBACK_URL`:
   `https://<host>/api/v1/hooks/verification`.
3. In the **main** repository, add the secret `VERIFY_DISPATCH_TOKEN`. It is a fine-grained personal access token
   with access to *this repository only* and permission **Actions: Read and write**. The variable `VERIFY_REPO`
   defaults to `DominikVladar/cairn-commons-verify`. The scheduled job `dispatch-verifications` then starts runs
   for queued verifications.
4. Run **Actions → Self-test → Run workflow** once. It warms the cache and proves the pipeline works.

Results are posted with an HMAC-SHA256 signature (`X-Cairn-Signature`) over the JSON body. The policy logic
(`scripts/lean-policy.mjs`) is unit-tested in the main repository (`packages/checkers/test/lean-policy.test.ts`).
