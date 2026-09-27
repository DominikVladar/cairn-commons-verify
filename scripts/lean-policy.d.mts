export const ALLOWED_AXIOMS: string[];
export function stripCommentsAndStrings(src: string): string;
export function scanLeanSource(src: string): { ok: boolean; violations: string[]; imports: string[] };
export function checkFormalStatement(text: string): { ok: boolean; violations: string[] };
export function buildTargetFile(target: string, imports?: string): string;
export interface Inspection {
  found: boolean;
  isTheorem: boolean;
  inSubmission: boolean;
  axioms: string[];
  targetMatches: boolean | null;
  error: string | null;
}
export function parseInspection(output: string): Inspection | null;
export function evaluate(input: {
  scan: { ok: boolean; violations: string[] };
  buildOk: boolean;
  checkerOk: boolean;
  inspection: Inspection | null;
  theorem: string;
  target: string | null;
  targetViolations?: string[];
}): { status: "passed" | "failed" | "error"; reason: string; axioms?: string[] };
