// Job 2 (trusted, no secrets): combine observations into the verdict. Inputs come from files written by
// trusted steps of this job (the policy scan is re-computed here from the hash-checked source, not taken from job 1).
//   write-target — writes CairnVerify/Target.lean from TARGET_B64 (the pinned statement), if it passes the policy
//   evaluate     — reads inspection.txt (output of the compiled inspector) and writes result.json
import { readFileSync, writeFileSync } from "node:fs";
import { required, writeResult } from "./common.mjs";
import {
  buildTargetFile,
  checkFormalStatement,
  evaluate,
  parseInspection,
  scanLeanSource,
} from "./lean-policy.mjs";

const mode = process.argv[2];
const theorem = process.env.THEOREM || "main";
const target = process.env.TARGET_B64 ? Buffer.from(process.env.TARGET_B64, "base64").toString("utf8") : null;

if (mode === "write-target") {
  // Only a statement that passes the term policy is ever compiled (in this trusted job).
  if (target && checkFormalStatement(target).ok)
    writeFileSync("CairnVerify/Target.lean", buildTargetFile(target, process.env.TARGET_IMPORTS));
} else {
  const scan = scanLeanSource(readFileSync("CairnVerify/Submission.lean", "utf8"));
  let inspectionOutput = "";
  try {
    inspectionOutput = readFileSync("inspection.txt", "utf8");
  } catch {}
  const verdict = evaluate({
    scan,
    buildOk: process.env.BUILD_OK === "true",
    checkerOk: process.env.CHECKER_OK === "true",
    inspection: parseInspection(inspectionOutput),
    theorem,
    target,
    targetViolations: target ? checkFormalStatement(target).violations : [],
  });
  writeResult("result.json", {
    runId: required("RUN_ID"),
    status: verdict.status,
    artifactSha256: required("ARTIFACT_SHA256"),
    log: verdict.reason,
    details: { axioms: verdict.axioms ?? null, theorem, targetChecked: !!target },
  });
}
