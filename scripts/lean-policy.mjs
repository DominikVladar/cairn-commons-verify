// Lean submission policy for Cairn Commons (plain JS, no dependencies; shared with the main repo's tests).
//
// Untrusted Lean files can run code at elaboration time (#eval, custom tactics/elaborators, initialize, …).
// We (1) reject such constructs statically, (2) elaborate in a job without secrets, and (3) accept only what a
// separate trusted job derives from the compiled .olean files (kernel replay with `leanchecker`, axioms and the
// target statement via the compiled inspector `CairnCheck.lean`, which never runs the submission's initializers).

export const ALLOWED_AXIOMS = ["propext", "Classical.choice", "Quot.sound"];

const BANNED = [
  { re: /\bsorry\b/, why: "`sorry` is not allowed" },
  { re: /\badmit\b/, why: "`admit` is not allowed" },
  { re: /^\s*(private\s+|protected\s+)?axiom\b/m, why: "new axioms are not allowed" },
  { re: /\bunsafe\b/, why: "`unsafe` is not allowed" },
  {
    re: /#eval\b|#exit\b|#print\s+axioms/,
    why: "`#eval` / `#exit` / `#print axioms` are not allowed in submissions",
  },
  { re: /\brun_cmd\b|\brun_tac\b|\brun_elab\b|\brun_meta\b/, why: "running meta code is not allowed" },
  {
    re: /^\s*(@\[[^\]]*\]\s*)?(elab|elab_rules|macro|macro_rules|syntax|declare_syntax_cat|simproc|dsimproc)\b/m,
    why: "defining syntax, macros, elaborators or simprocs is not allowed",
  },
  { re: /\b(initialize|builtin_initialize)\b/, why: "`initialize` is not allowed" },
  {
    re: /@\[\s*[^\]]*\b(extern|implemented_by|init|export)\b/,
    why: "`@[extern]`, `@[implemented_by]`, `@[init]` and `@[export]` are not allowed",
  },
  { re: /set_option\s+debug\./, why: "debug options are not allowed" },
  {
    re: /\bnative_decide\b|\bLean\.ofReduceBool\b/,
    why: "`native_decide` is not allowed (it trusts the compiler)",
  },
  { re: /\bIO\b|\bSystem\.FilePath\b/, why: "IO is not allowed" },
];

// Formal Conjectures (Google DeepMind, Apache-2.0) is pinned in lakefile.toml.in: problems imported from it pin their
// statements to its theorems, so proofs may import its modules (file names like 242.lean become «242»).
const ALLOWED_IMPORT =
  /^(Mathlib|Batteries|Aesop|Qq|Plausible|FormalConjectures|FormalConjecturesUtil|FormalConjecturesForMathlib)(\.([A-Za-z0-9_']+|«[A-Za-z0-9_'.-]+»))*$/;

/** Remove comments and string literals so that banned words inside them do not count (and cannot hide code). */
export function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  let depth = 0;
  while (i < src.length) {
    if (depth > 0) {
      if (src.startsWith("/-", i)) {
        depth++;
        i += 2;
      } else if (src.startsWith("-/", i)) {
        depth--;
        i += 2;
      } else {
        if (src[i] === "\n") out += "\n";
        i++;
      }
      continue;
    }
    if (src.startsWith("/-", i)) {
      depth = 1;
      i += 2;
    } else if (src.startsWith("--", i)) {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (src[i] === '"') {
      i++;
      while (i < src.length && src[i] !== '"') i += src[i] === "\\" ? 2 : 1;
      i++;
      out += '""';
    } else {
      out += src[i];
      i++;
    }
  }
  return out;
}

/** Static checks. Returns { ok, violations: string[], imports: string[] }. */
export function scanLeanSource(src) {
  const violations = [];
  if (typeof src !== "string" || src.length === 0)
    return { ok: false, violations: ["empty file"], imports: [] };
  if (src.length > 1_000_000) violations.push("file larger than 1 MB");
  const code = stripCommentsAndStrings(src);
  const imports = [...code.matchAll(/^\s*import\s+(.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
  for (const imp of imports)
    if (!ALLOWED_IMPORT.test(imp))
      violations.push(
        `import ${imp} is not allowed (only Mathlib, Batteries, Aesop, Qq, Plausible and Formal Conjectures)`,
      );
  for (const b of BANNED) if (b.re.test(code)) violations.push(b.why);
  return { ok: violations.length === 0, violations, imports };
}

/**
 * A pinned formal statement is compiled in the trusted job (it defines what a proof must prove), so it must be a
 * plain `Prop` term: the submission policy applies, and additionally no tactic blocks (`by`), no `do` blocks, no
 * commands (a newline + `theorem …` would otherwise start a new declaration) and no attributes or options. Term
 * elaboration then only runs Mathlib's own, trusted elaborators.
 */
const TARGET_BANNED_WORDS = [
  "by",
  "do",
  "import",
  "open",
  "def",
  "theorem",
  "lemma",
  "example",
  "abbrev",
  "instance",
  "structure",
  "inductive",
  "class",
  "namespace",
  "section",
  "end",
  "variable",
  "universe",
  "axiom",
  "attribute",
  "set_option",
  "macro",
  "syntax",
  "elab",
  "notation",
  "infix",
  "infixl",
  "infixr",
  "prefix",
  "postfix",
  "mutual",
  "noncomputable",
  "private",
  "protected",
  "opaque",
  "deriving",
  "partial",
  "unsafe",
];

export function checkFormalStatement(text) {
  const violations = [];
  if (typeof text !== "string" || !text.trim()) return { ok: false, violations: ["the statement is empty"] };
  if (text.length > 5000) violations.push("the statement is longer than 5000 characters");
  const scan = scanLeanSource(text);
  violations.push(...scan.violations);
  const code = stripCommentsAndStrings(text);
  if (/"/.test(code)) violations.push("string literals are not allowed in a statement");
  for (const w of TARGET_BANNED_WORDS)
    if (new RegExp(`(^|[^\\w.'])${w}(?![\\w'])`).test(code))
      violations.push(`\`${w}\` is not allowed in a statement`);
  if (/@\[|#[a-z]/.test(code)) violations.push("attributes and `#` commands are not allowed in a statement");
  return { ok: violations.length === 0, violations: [...new Set(violations)] };
}

/**
 * Trusted target module (compiled in the check job, never imports the submission): defines `cairnTarget : Prop`
 * as the problem's pinned statement. The inspector then asks the kernel whether the theorem's type is
 * definitionally equal to it.
 */
export function buildTargetFile(target, imports = "Mathlib") {
  if (typeof target !== "string" || !target.trim()) throw new Error("empty target statement");
  const check = checkFormalStatement(target);
  if (!check.ok) throw new Error(`target statement rejected: ${check.violations.join("; ")}`);
  const header = imports
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => {
      if (!ALLOWED_IMPORT.test(m)) throw new Error(`invalid import ${m}`);
      return `import ${m}`;
    });
  return `${[...header, "", `def cairnTarget : Prop := ${target.trim()}`].join("\n")}\n`;
}

/** Parse the one-line JSON printed by the trusted inspector (`CairnCheck.lean`); null if unusable. */
export function parseInspection(output) {
  const line = String(output ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{"))
    .pop();
  if (!line) return null;
  try {
    const j = JSON.parse(line);
    if (typeof j.found !== "boolean" || !Array.isArray(j.axioms)) return null;
    return {
      found: j.found,
      isTheorem: j.isTheorem === true,
      inSubmission: j.inSubmission === true,
      axioms: j.axioms.filter((a) => typeof a === "string"),
      targetMatches: typeof j.targetMatches === "boolean" ? j.targetMatches : null,
      negationMatches: typeof j.negationMatches === "boolean" ? j.negationMatches : null,
      error: typeof j.error === "string" ? j.error : null,
    };
  } catch {
    return null;
  }
}

/** Final verdict from the trusted job's observations. */
export function evaluate({
  scan,
  buildOk,
  checkerOk,
  inspection,
  theorem,
  target,
  targetViolations = [],
  targetBuildOk = true,
  acceptNegation = false,
}) {
  // A proof is only worth something relative to the statement it proves: without a pinned statement a run could
  // "verify" `theorem main : True`, so it never passes.
  if (!target)
    return { status: "failed", reason: "no pinned statement: the proof is not tied to what it should prove" };
  if (targetViolations.length)
    return { status: "failed", reason: `pinned statement rejected: ${targetViolations.join("; ")}` };
  if (!targetBuildOk)
    return {
      status: "failed",
      reason: "the pinned statement does not elaborate (it is not a valid Lean Prop)",
    };
  if (!scan.ok) return { status: "failed", reason: `policy: ${scan.violations.join("; ")}` };
  if (!buildOk) return { status: "failed", reason: "the submission does not compile" };
  if (!checkerOk) return { status: "failed", reason: "kernel replay (leanchecker) failed" };
  if (!inspection) return { status: "error", reason: "the inspector produced no result" };
  if (!inspection.found) return { status: "failed", reason: `theorem ${theorem} not found` };
  if (!inspection.isTheorem) return { status: "failed", reason: `${theorem} is not a theorem` };
  if (!inspection.inSubmission)
    return { status: "failed", reason: `${theorem} is not declared in the submitted file` };
  const axioms = inspection.axioms;
  const extra = axioms.filter((a) => !ALLOWED_AXIOMS.includes(a));
  if (extra.length)
    return { status: "failed", reason: `uses disallowed axioms: ${extra.join(", ")}`, axioms };
  if (acceptNegation && inspection.targetMatches !== true && inspection.negationMatches === true)
    return {
      status: "passed",
      reason: "compiles, kernel-checked, standard axioms only, proves the NEGATION of the pinned statement",
      axioms,
      negation: true,
    };
  if (target && inspection.targetMatches !== true)
    return {
      status: "failed",
      reason: `the theorem does not prove the pinned statement${inspection.error ? ` (${inspection.error})` : ""}`,
      axioms,
    };
  return {
    status: "passed",
    reason: "compiles, kernel-checked, standard axioms only, proves exactly the pinned statement",
    axioms,
  };
}
