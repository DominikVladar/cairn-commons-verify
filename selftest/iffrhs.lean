import Mathlib.Order.Basic

/-- Self-test: a yes/no statement pinned as `a ↔ P` (like Formal Conjectures' `answer(sorry) ↔ P`, here with the
answer known) is answered by a proof of `¬ P`, the negation of its right-hand side (must pass). -/
theorem main : ¬ ∀ {m n : ℕ}, m ≤ n := fun h => absurd (@h 1 0) (by decide)
