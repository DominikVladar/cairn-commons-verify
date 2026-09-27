import Mathlib.Data.Nat.Prime.Basic

/-- Self-test: classical reasoning is fine (standard axioms only); must pass against its pinned statement. -/
theorem main (p : Prop) : p ∨ ¬p := Classical.em p
