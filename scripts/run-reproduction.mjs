// Reproduction runner (trusted host script). The untrusted code runs only inside a Docker container with no
// network, read-only root filesystem, memory/CPU/pid limits and a wall-clock timeout.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchArtifact, required, writeResult } from "./common.mjs";

// Keep in sync with `verification.reproductionImages` in the main repository's packages/core/src/config.ts.
const ALLOWED_IMAGES = new Set([
  "python:3.12-slim",
  "node:22-slim",
  "julia:1.11",
  "gcc:14",
  "rust:1-slim",
  "sagemath/sagemath:10.6",
]);
const image = required("IMAGE");
if (!ALLOWED_IMAGES.has(image)) throw new Error(`image not allowed: ${image}`);
const command = required("COMMAND");
const expectedSha = required("EXPECTED_SHA256");
const timeout = Math.min(Number(process.env.TIMEOUT_SECONDS ?? "600"), 3000);

// ARTIFACT_FILE (a local path) replaces the download in the self-test workflow.
const { buf, sha } = process.env.ARTIFACT_FILE
  ? (() => {
      const b = readFileSync(process.env.ARTIFACT_FILE);
      return { buf: b, sha: createHash("sha256").update(b).digest("hex") };
    })()
  : await fetchArtifact(required("ARTIFACT_URL"), required("ARTIFACT_SHA256"));
mkdirSync("work", { recursive: true });
// The artifact keeps the file name it was uploaded with (FILENAME); the command refers to that name.
const name =
  process.env.FILENAME && /^[\w.-]+$/.test(process.env.FILENAME) ? process.env.FILENAME : "main.py";
writeFileSync(`work/${name}`, buf);

const pull = spawnSync("docker", ["pull", "--quiet", image], { encoding: "utf8" });
if (pull.status !== 0) throw new Error(`docker pull failed: ${pull.stderr}`);
const run = spawnSync(
  "timeout",
  [
    "--kill-after=10",
    String(timeout),
    "docker",
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,size=512m",
    "--memory",
    "2g",
    "--cpus",
    "2",
    "--pids-limit",
    "256",
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "--user",
    "65534:65534",
    "-v",
    `${process.cwd()}/work:/work:ro`,
    "-w",
    "/tmp",
    image,
    "sh",
    "-c",
    // The code is mounted read-only; it runs from a writable copy so compilers can write their output
    // (e.g. `gcc main.c && ./a.out`).
    `mkdir -p /tmp/w && cp -r /work/. /tmp/w && cd /tmp/w && ${command}`,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const stdout = (run.stdout ?? "").trim();
const gotSha = createHash("sha256").update(stdout).digest("hex");
const timedOut = run.status === 124 || run.status === 137;
const status = run.status === 0 && gotSha === expectedSha ? "passed" : timedOut ? "error" : "failed";
writeResult("result.json", {
  runId: required("RUN_ID"),
  status,
  artifactSha256: sha,
  log: [
    `exit ${run.status}${timedOut ? " (timeout)" : ""}`,
    `stdout sha256 ${gotSha}`,
    `expected ${expectedSha}`,
    (run.stderr ?? "").slice(-2000),
  ].join("\n"),
  details: { exitCode: run.status, stdoutSha256: gotSha, stdoutHead: stdout.slice(0, 1000), image },
});
