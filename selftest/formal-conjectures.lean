import FormalConjectures.Wikipedia.AmicableNumbers

/-- Self-test: statements pinned to a Formal Conjectures theorem (imported problems) are elaborated and compared
in the trusted job, with the library built from its pinned source (must pass). -/
theorem main : type_of% @AmicableNumbers.amicable_220_284 := AmicableNumbers.amicable_220_284
