import Mathlib.Logic.Basic

/-- Self-test: classical reasoning is fine (standard axioms only); must pass without a target. -/
theorem main (p : Prop) : p ∨ ¬p := Classical.em p
