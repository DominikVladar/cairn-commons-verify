import Mathlib.Data.Nat.Prime.Basic

/-- Self-test: a proof of the NEGATION of a problem's yes/no statement settles it the other way (must pass). -/
theorem main : ¬ ∀ n : ℕ, Nat.Prime n := fun h => Nat.not_prime_zero (h 0)
