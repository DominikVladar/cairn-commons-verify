// Job 3 (has the webhook secret, never runs untrusted code): validate result.json strictly, sign, POST.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { required } from "./common.mjs";

const raw = JSON.parse(readFileSync("result.json", "utf8"));
const result = {
  runId: String(raw.runId),
  status: ["passed", "failed", "error"].includes(raw.status) ? raw.status : "error",
  artifactSha256: String(raw.artifactSha256),
  log: String(raw.log ?? "").slice(0, 20000),
  externalUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  details: typeof raw.details === "object" && raw.details ? raw.details : {},
};
if (!/^[0-9a-f-]{36}$/.test(result.runId) || !/^[0-9a-f]{64}$/.test(result.artifactSha256))
  throw new Error("malformed result");
if (result.runId !== required("RUN_ID")) throw new Error("run id mismatch");
const body = JSON.stringify(result);
const sig = `sha256=${createHmac("sha256", required("WEBHOOK_SECRET")).update(body).digest("hex")}`;
const callback = required("CALLBACK_URL");
if (!/^https:\/\//.test(callback)) throw new Error("callback must be https");
const r = await fetch(callback, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Cairn-Signature": sig },
  body,
});
console.log(`callback HTTP ${r.status}: ${(await r.text()).slice(0, 500)}`);
if (!r.ok && r.status !== 409) process.exit(1);
