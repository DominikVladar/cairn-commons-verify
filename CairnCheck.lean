/-
Trusted inspector for a compiled Lean submission (runs in the `check` job, no secrets).

Why a compiled program instead of `lake env lean Check.lean`: the Lean frontend runs the `initialize` blocks of
every imported module, so importing an untrusted `.olean` there would let it execute code and forge the result.
This program uses `importModules` without enabling initializer execution (like `leanchecker`), so the
submission's `.olean` is only read as data.

Usage: cairncheck <theorem> [--target [--negation]]
  Imports `CairnVerify.Submission` (and `CairnVerify.Target` with `--target`, which defines `cairnTarget : Prop`
  from the pinned statement) and prints one JSON object:
  { "found", "isTheorem", "inSubmission", "axioms": [..], "targetMatches": true|false|null,
    "negationMatches": true|false|null, "error": null|".." }
  With `--negation` (a problem's curated yes/no statement), a proof of `¬ cairnTarget` is recognised too: it settles
  the problem the other way.
-/
import Lean

open Lean

/-- All axioms a constant depends on, transitively (same traversal as `#print axioms`). -/
partial def collectAxioms (env : Environment) (root : Name) : Array Name := Id.run do
  let mut seen : NameSet := {}
  let mut axioms : Array Name := #[]
  let mut stack : Array Name := #[root]
  while !stack.isEmpty do
    let n := stack.back!
    stack := stack.pop
    if seen.contains n then continue
    seen := seen.insert n
    match env.find? n with
    | none => pure ()
    | some ci =>
      if let .axiomInfo _ := ci then axioms := axioms.push n
      let refs := ci.type.getUsedConstants ++ ((ci.value? (allowOpaque := true)).map (·.getUsedConstants) |>.getD #[])
      let refs := match ci with
        | .inductInfo v => refs ++ v.ctors.toArray
        | .ctorInfo v => refs.push v.induct
        | .recInfo v => refs ++ v.all.toArray
        | _ => refs
      for r in refs do
        unless seen.contains r do stack := stack.push r
  return axioms.qsort (·.toString < ·.toString)

def optBool : Option Bool → Json
  | some b => toJson b
  | none => Json.null

def result (found isThm inSub : Bool) (axioms : Array Name) (target : Option Bool) (err : Option String)
    (negation : Option Bool := none) : Json :=
  Json.mkObj [
    ("found", found), ("isTheorem", isThm), ("inSubmission", inSub),
    ("axioms", toJson (axioms.map (·.toString))),
    ("targetMatches", optBool target),
    ("negationMatches", optBool negation),
    ("error", match err with | some e => toJson e | none => Json.null)]

def main (args : List String) : IO UInt32 := do
  let (thmStr, withTarget, withNegation) ← match args with
    | [t] => pure (t, false, false)
    | [t, "--target"] => pure (t, true, false)
    | [t, "--target", "--negation"] => pure (t, true, true)
    | _ => throw <| IO.userError "usage: cairncheck <theorem> [--target [--negation]]"
  let thm := thmStr.toName
  if thm.isAnonymous then
    IO.println (result false false false #[] none (some "invalid theorem name")).compress
    return 0
  initSearchPath (← findSysroot)
  let sub := `CairnVerify.Submission
  let mods := if withTarget then #[sub, `CairnVerify.Target] else #[sub]
  -- No `enableInitializersExecution`: imported initializers are NOT run.
  let env ← importModules (mods.map ({ module := · })) {} (trustLevel := 0) (loadExts := false)
  let some ci := env.find? thm
    | IO.println (result false false false #[] none (some s!"{thm} not found")).compress; return 0
  let isThm := ci matches .thmInfo _
  let inSub := match env.getModuleIdxFor? thm with
    | some idx => env.header.moduleNames[idx.toNat]? == some sub
    | none => false
  let axioms := collectAxioms env thm
  let mut target : Option Bool := none
  let mut negation : Option Bool := none
  let mut err : Option String := none
  if withTarget then
    match env.find? `cairnTarget with
    | some (.defnInfo t) =>
      if t.levelParams.length == ci.levelParams.length then
        let ty := ci.type.instantiateLevelParams ci.levelParams (t.levelParams.map Level.param)
        match Kernel.isDefEq env {} ty t.value with
        | .ok b => target := some b
        | .error _ => target := some false; err := some "kernel error while comparing with the target"
        if withNegation && target != some true then
          match Kernel.isDefEq env {} ty (mkApp (mkConst ``Not) t.value) with
          | .ok b => negation := some b
          | .error _ => negation := some false
      else
        target := some false
        err := some "universe parameters differ from the target statement"
    | _ => target := some false; err := some "target statement missing"
  IO.println (result true isThm inSub axioms target err negation).compress
  return 0
