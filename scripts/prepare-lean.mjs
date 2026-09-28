// Job 1 (untrusted, no secrets): download the submission, apply the static policy, write the Lean module.
// ARTIFACT_FILE (a local path) replaces the download in the self-test workflow.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchArtifact, required, writeResult } from "./common.mjs";
import { scanLeanSource } from "./lean-policy.mjs";

let buf;
let sha;
if (process.env.ARTIFACT_FILE) {
  buf = readFileSync(process.env.ARTIFACT_FILE);
  sha = createHash("sha256").update(buf).digest("hex");
} else {
  ({ buf, sha } = await fetchArtifact(required("ARTIFACT_URL"), required("ARTIFACT_SHA256"), 6_000_000));
}
const src = buf.toString("utf8");
const scan = scanLeanSource(src);
mkdirSync("CairnVerify", { recursive: true });
writeFileSync("CairnVerify/Submission.lean", src);
writeResult("policy.json", { sha256: sha, scan });
if (!scan.ok) console.log(`::warning::policy violations: ${scan.violations.join("; ")}`);
