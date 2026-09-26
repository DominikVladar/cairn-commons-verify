import Mathlib.Data.Nat.Prime.Basic

/-- Self-test: a valid proof of a weaker statement than the pinned target; must fail the target check. -/
theorem main : ∀ n : ℕ, 2 ≤ n → ∃ p, p ∣ n := fun n _ => ⟨n, dvd_refl n⟩
