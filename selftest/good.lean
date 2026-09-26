import Mathlib.Data.Nat.Prime.Basic

/-- Self-test: a correct proof that must pass, also against the pinned target statement. -/
theorem main : ∀ n : ℕ, 2 ≤ n → ∃ p, Nat.Prime p ∧ p ∣ n := fun n hn =>
  ⟨n.minFac, Nat.minFac_prime (by omega), Nat.minFac_dvd n⟩
