import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

/** Download an artifact from the Cairn Commons API and verify its SHA-256. */
export async function fetchArtifact(url, expectedSha256, maxBytes = 5 * 1024 * 1024) {
  if (!/^https:\/\//.test(url)) throw new Error("artifact URL must be https");
  const r = await fetch(url, { redirect: "error" });
  if (!r.ok) throw new Error(`download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("artifact too large");
  const sha = createHash("sha256").update(buf).digest("hex");
  if (expectedSha256 && sha !== expectedSha256) throw new Error(`sha256 mismatch: got ${sha}`);
  return { buf, sha };
}

export function writeResult(path, result) {
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

export function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}
