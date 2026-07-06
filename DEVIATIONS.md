# DEVIATIONS from the design doc (Content-Addressed Concepts, FINAL DRAFT rev 2, 2026-07-06)

This prototype implements the doc's numbered hashing steps (§6), record shape (§5),
grammar (§4) and verification (§7) exactly, EXCEPT where the doc was ambiguous,
incomplete, or — in one case (D8) — self-contradictory when executed. Each deviation
below states what the doc says, what the implementation does, and what the doc should
say. The doc must be corrected before gisting.

## D8 — the duplicate-FDH rule rejects the doc's own golden records (doc BUG; rule re-based on bounded refinement)

**Doc (§6 step 1):** "compute every blank node's RDFC-1.0 first-degree hash — if any two
blank nodes in one record … share a first-degree hash, reject with
`ERR_DUPLICATE_BNODE_FDH`", justified as making canonicalization linear ("no blank node
ever enters RDFC's Hash-N-Degree-Quads recursion").

**Executed reality:** every `[ cdef:ref "n" ]` coreference-mention node has a
byte-identical one-quad subtree and an identical parent-mention shape, so ANY record
that mentions a referent twice — including the doc's own §3.3 `gufo:Event` and §3.4
`bookmark:archived` normative examples, and every quote with a repeated
`[ cdef:head p:I ]` experiencer — trips the rule. The rule as written and the §3/§4
record format are mutually exclusive; the doc's claim that "duplicate sibling subtrees
are redundant assertions" is false for `cdef:ref` mention nodes, which are the
*designed* coreference mechanism.

**Implemented:** bounded Weisfeiler-Leman-style color refinement, seeded with each
blank node's RDFC-1.0 first-degree hash and refined quad-position-aware with
neighbours' colors for ≤16 rounds (or until the partition stabilizes). Only blank
nodes still indistinguishable — i.e. locally automorphic structures such as
byte-identical sibling subtrees, exactly the class that fuels HNDQ's permutation
search — are rejected, with the doc's error code. Coreference mentions under distinct
parents separate in one or two rounds and are accepted.

**Consequence for the doc's complexity claim:** it must weaken from "no bnode ever
enters HNDQ" to "every FDH-group that enters HNDQ is refinement-distinguishable within
depth-bounded rounds, so HNDQ resolves without permutation exploration"; RDFC-1.0
§7.1's mandatory abort (rdf-canonize's default work factor) remains the fail-closed
backstop. **Doc fix required in §6 step 1.**

## D1 — restriction node shape (doc gap; completed)

§5 closes the axiom-relation set with `restriction` and whitelists "restriction
cardinalities" as literals, but never defines the restriction target's shape. Pinned
here as:

```turtle
[ cdef:rel cdef:restriction ; cdef:target
  [ cdef:onProperty <concept-ref> ;                                  # required
    cdef:minCardinality|cdef:maxCardinality|cdef:cardinality "n"^^xsd:nonNegativeInteger ;  # 0..3
    cdef:allValuesFrom|cdef:someValuesFrom <concept-ref> ] ]         # 0..1
```

with at least one cardinality or value constraint present. Doc fix: add this to §5.

## D2 — WHEN / LIKE argument predicates (doc gap; completed)

§4.5 gives arities (`WHEN(2: time-clause, main)`, `LIKE(2: comparandum, target)`) but
the RDF encoding names no predicates for them (only the operators used in §3's examples
are shown). Implemented: WHEN and LIKE reuse `cdef:anchor` (time-clause / comparandum)
+ `cdef:scope` (main / target), keeping the vocabulary closed. Doc fix: pin these in
§4.5/§4.7 (grammar.ttl).

## D3 — grounding-lexicon table (deferred to a bundle that doesn't exist; pinned here)

§3.5 rule 3 admits "closed function-word allolexes" and "closed punctuation" but defers
the tables to the profile bundle. The prototype pins concrete tables in `src/primes.ts`
(prime exponents + closed inflected surface forms + closed function words +
`. , ; : ' " ( ) - ? !` + the literal `[m]` flag; matching case-insensitive after NFC).
These tables are conformance-defining: the bundle must publish exactly one such table.

## D4 — introduction-before-use at clause granularity

§4.2: "a `cdef:ref` to an undeclared or not-yet-introduced index is a gate error."
Within one clause, RDF predicate multisets are unordered, so sub-clause "before" is
only defined via each operator's argument order. Implemented: enforcement at CLAUSE
granularity — a clause's binds are collected before its refs are checked, and later
clauses (in the top-level or quote clause list) see earlier clauses' binds. The doc's
own §3.4 record (bind 3 in an IF antecedent, ref 3 in its consequent, same clause) is
legal under this reading. Doc fix: state the granularity.

## D5 — validation-step ordering (grammar checks after resolution)

§6 puts the grammar/valency checks in step 1, before step 2 resolves references — but
valency, operator and word-class checks require knowing WHICH prime a reference
denotes, which only exists post-resolution (registry lookup of a final URN). Implemented:
structural shape/caps/reserved/lexicon checks at step 1; §4 grammar checks run per-SCC
after resolution (still strictly before hashing). No byte or hash consequence.
Consequently `cdef:pred`/`cdef:op` positions REQUIRE a reference to a prime known to
the minting registry (the standard prime set is auto-minted and registered).

## D6 — molecule depth: unknown and cyclic references

§3.5 rule 5's depth is well-founded only on acyclic, fully-known references.
Implemented: (a) an external URN not present in the local registry contributes depth 0
(the "already-minted" precondition is only checkable against a registry the verifier
trusts); (b) same-SCC references are excluded from the depth fold (grounding refs can
never be intra-SCC per rule 4, but axiom cycles between molecules are representable and
the +1 recursion is ill-founded on them). Doc fix: define molecule depth for cyclic
axiom references and name the registry dependency.

## D7 — verify re-checks canonical member ordering (narrowing)

§7's component path says "recompute steps 8–9". The implementation additionally
recomputes steps 6–7 (the ordering keys) and REJECTS a served component whose member
indices don't follow the byte-lexicographic ordering-key sort. Without this, a
self-consistent but non-canonically-ordered component (producible only by a
non-conforming minter) would verify under its own URN. Strictly a narrowing — no
conforming artifact is affected. Doc fix: add the ordering re-check to §7.

## D9 — smaller pinned readings

- **Prime shorthand in doc examples** (`p:TIME`, `p:SOMETHING`, `p:PEOPLE`) resolves to
  the canonical allolex-set records (`WHEN~TIME`, `SOMETHING~THING`, `PEOPLE`). Chart
  indices are pinned as the 1-based position in the §4.1 listing — confirmed by the
  doc's own normative `KIND` example (chartIndex 7).
- **VERY/MORE over modifiers** (§4.3 "mod … optionally under VERY/MORE") has no defined
  node shape in the RDF encoding; the prototype accepts only bare modifier primes.
  Doc fix: define the structured-mod form or drop the clause from profile-1.
- **AxiomsOnly requires ≥1 axiom** (an empty record would otherwise hash); Explicated
  requires an explication; Prime forbids axioms/explication/grounding; Molecule
  requires exactly one grounding note. Only the last three are doc-explicit.
- **`AFTER`/`BEFORE` anchor-only form** is accepted only in filler position (the doc's
  "also usable as a time-adjunct filler with anchor only").
- **Verification is structural-only** (shape + caps + reserved tokens + recompute), per
  §7 — no §4 grammar pass and no registry needed at verify. Signed-annotation
  acceptance (§9) is out of scope for the prototype: a served definition representation
  must contain exactly the record, nothing else.
- **`urn:x-mint:`** is this implementation's symbolic-name scheme for not-yet-minted
  records in a mint set (the doc's "names still symbolic" input); it is rejected
  everywhere outside mint-set inputs, including in all served content.
- **Serving-path host** defaults to `models.jeswr.org` (`/i/<multibase>`) per §7's
  phase-1 decision; overridable via `--host`.
- **Component canonical-size cap**: the 65,536-byte cap is applied to each member's
  ordering-key serialization (a per-record proxy) — the component dataset itself is
  bounded by 32 × the per-record cap. Doc fix: state which serialization the cap
  measures for cyclic members.
