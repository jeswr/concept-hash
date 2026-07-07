# @jeswr/concept-hash

Content-addressed concept hasher — the PROTOTYPE of the *Content-Addressed
Concepts* design (profile-1, `urn:concept-def:1`): ontology concepts identified
by a cryptographic hash of their definition, so nobody owns a concept and
nobody can edit what a hash means. Changing anything inside the hash boundary
mints a *new* concept; the old one stays what it was, forever.

Status: **prototype / under active development.** Implementation deviations
from the design doc are recorded precisely in [DEVIATIONS.md](./DEVIATIONS.md)
— read D8 first: the doc's literal duplicate-FDH rule rejects its own §3.4
golden record, and this implementation re-bases it on bounded color refinement.

## What it implements (the doc's §6 steps, exactly)

0. **Extraction** (§5): from an authored document, the definition record =
   the focus subject's profile-vocabulary triples + the blank-node TREES they
   reach. Everything else is ignored at mint (labels beside a definition don't
   change the hash — golden vector 11) and REJECTED at verify.
1. **Validation** (fail-closed): closed SHACL-equivalent shape, the §5 caps
   table, the reserved-token rule (`urn:concept-def:` is reserved except
   `#self` and the profile vocabulary), the literal whitelist, the §4
   explication grammar (valency frames, operator arities, referent
   discipline), prime-lexicon byte-match (`ERR_PRIME_LEXICON_MISMATCH`),
   grounding-note controlled lexicon (`ERR_GROUNDING_LEXICON`) + molecule
   depth, and the duplicate-FDH / automorphism gate
   (`ERR_DUPLICATE_BNODE_FDH`; DEVIATIONS.md D8).
2. **Reference resolution**: symbolic mint-set names + alias table → final
   `urn:concept:` URNs (decode-validated, never regex-only). No by-name
   references in hashed content, ever.
3. **Literal normalization**: NFC everywhere; canonical XSD 1.1 lexical forms
   (integer / nonNegativeInteger / decimal / double / boolean); lowercase
   language tags (deliberate BCP47 divergence, per the doc).
4. **Dependency graph → Tarjan SCCs**, processed in reverse topological order.
5. **Singleton hashing**: own IRI → `#self` everywhere (self-references
   included); RDFC-1.0 (rdf-canonize, SHA-256); hash input =
   `UTF8("urn:concept-def:1\n") ‖ canonical N-Quads` — the profile header is
   *inside* the digest.
6. **Cyclic SCCs**: per-member ordering keys via the exact rewrite table
   (own IRI → `#self`, any other member → `#intra`).
7. **Canonical indices**: byte-lexicographic sort of ordering keys; duplicate
   keys ⇒ `ERR_SYMMETRIC_SCC` (fail closed).
8. **Component record**: one RDF dataset, member *i* in named graph
   `#member-i`, default graph empty; canonicalized and hashed with the same
   in-band header.
9. **Member hashes**: `H(UTF8("urn:concept-def:1#member\n") ‖ X_raw ‖ uvarint(i))`
   with `X_raw` the raw 32 digest bytes and LEB128 uvarint.
10. **Emission**: multihash (`sha2-256`, code 0x12, length 0x20) → multibase
    base32 (`b…`, lowercase, no padding) → `urn:concept:<multibase-multihash>`
    + the HTTPS serving path `https://models.jeswr.org/i/<multibase>`.

**Verification** (§7, byte-pinned): served bytes must already be canonical
(non-NFC / non-canonical-lexical / non-lowercase-langtag content is REJECTED,
never normalized; served `application/n-quads` must equal the canonical bytes
exactly). Singleton: shape + caps + reserved tokens → recompute → byte-compare.
Component: contiguous `#member-0…#member-(n−1)` graphs, empty default graph,
per-graph record shape, canonical member ordering re-check, recompute steps
8–9 — which yields EVERY member URN; the requested URN must be in that set
(the index is recomputed, never conveyed).

## Install / gate

```bash
npm install            # the committed .npmrc sets ignore-scripts=true, so no
                       # dependency lifecycle hooks run; outside this repo, use
                       # `npm install --ignore-scripts` to get the same guarantee
npm run gate           # lint (biome) + typecheck (tsc) + test (vitest) + build
```

## CLI

One authored record per Turtle file; the record's symbolic name is the file
basename, its focus IRI `urn:x-mint:<name>`. References to other mint-set
records use `urn:x-mint:<other>`; references to the 65 auto-minted NSM primes
use `urn:x-mint:prime:<NAME>` (e.g. `<urn:x-mint:prime:KIND>`); references to
already-minted external concepts use their final `urn:concept:` URNs (or an
`--aliases` JSON of name → URN).

```bash
concept-hash hash test/fixtures/bookmarks/*.ttl [--aliases a.json] [--host h] [--json]
concept-hash verify urn:concept:bciq… served.nq
concept-hash explain archived test/fixtures/bookmarks/*.ttl   # prints the exact canonical hash-input bytes
```

## API

```ts
import { mint, verifyServed, parseRdf } from '@jeswr/concept-hash';

const result = await mint([{ name: 'bookmark', quads: parseRdf(turtle) }]);
const { urn, servingUrl, canonicalNQuads } = result.records.get('bookmark')!;

// verify-by-recompute from served bytes
await verifyServed(urn, parseRdf(canonicalNQuads, 'application/n-quads'), {
  servedNQuads: canonicalNQuads,
});
```

## Golden vectors

Committed in `test/fixtures/` with pinned URNs in
`test/fixtures/golden-urns.json` (regenerate only with
`GOLDEN_UPDATE=1 npx vitest run test/golden` — a diff there is a
hash-breaking change, i.e. a NEW profile):

| Vector | Fixture | Pins |
|---|---|---|
| NSM prime records (existence proof 0) | auto-minted 65-prime set | §3.2 record form; `KIND` chartIndex 7; ordered allolexes (`SOMETHING~THING`); the `DON'T-WANT` apostrophe byte |
| `gufo:Event` walked to primes (existence proof 1) | `gufo/` | §3.3 verbatim: InstanceSchema frame, TimeRef referent, AFTER/NOT/CAN operators |
| Bookmarks sector re-expressed (existence proof 2) | `bookmarks/` (7 concepts) | §3.4 `archived` verbatim (quote re-anchoring, quote-local referent 3, `restrictedBy`), maker-coreference `Bookmark`, XSD bridge concepts |
| Simple concepts | `bookmarks/title.ttl`, `notes.ttl` | name-free identity: identical definitions mint the SAME URN (`title` ≡ `notes`) |
| Cyclic pair (SCC) | `cycle/` | steps 6–9: ordering keys, `#member-i` graphs, member-hash derivation; a SELF-referencing member pins the self-vs-intra rewrite (doc vector 9) |
| Restriction bnode | `restriction/titled-bookmark.ttl` | the D1 restriction node shape |
| Molecule-flagged concept | `molecule/molecule-web.ttl` | `[m]` status + controlled grounding note |
| Unicode gloss | programmatic (`test/golden/reproducibility.test.ts`) | NFD vs NFC authored glosses mint identically; linked-ref `{urn|gloss}` form |
| Annotation invariance (doc vector 11) | `annotations/annotations-beside.ttl` | labels beside the definition are ignored at mint, identical URN |
| Coreference is meaning (doc vector 6) | programmatic | `[ cdef:ref "1" ]` vs fresh `SOMETHING` mint different URNs |
| Byte-reproducibility | programmatic | bnode-renamed, order-shuffled isomorphic copies mint byte-identical output |

## Untrusted-input surface

Attacker-supplied definitions fail CLOSED: a 4 MiB pre-parse input guard, the
§5 caps table (64 KiB canonical record, ≤256 bnodes / ≤64 structural, depth
≤12, lists ≤64, ≤32 clauses/referents, SCC ≤32, 1 KiB grounding note), bnode
TREE discipline (two parents or a cycle rejects), the refinement-based
duplicate-FDH gate against RDFC poison graphs (with rdf-canonize's own
work-factor abort as the backstop), reserved-token forgery (`#intra` /
`#member-N` / invented `cdef:` IRIs), decode-validated reference syntax, and
reject-don't-normalize verification. See `test/security/untrusted.test.ts`.

## Provenance

AUTHORED-BY Claude Fable 5 (the PSS agent) — prototype for the
Content-Addressed Concepts design (maintainer-decided D1–D4 architecture).
Design rationale lives in the design doc; implementation deviations in
[DEVIATIONS.md](./DEVIATIONS.md).
