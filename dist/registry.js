// AUTHORED-BY Claude Fable 5
/**
 * The known-concepts registry: URN → {semanticStatus, prime identity,
 * molecule depth}. Grammar checks (§4.4/§4.5) need prime *identity* for a
 * reference used in a pred/op/det/quant/mod/head position, and the molecule
 * nesting bound (§3.5 rule 5) needs each referenced concept's molecule
 * depth; both are registry lookups.
 *
 * Minting registers every minted concept; the standard prime set can be
 * pre-minted with `standardPrimeSet()` (see primeset.ts).
 */
export class ConceptRegistry {
    byUrn = new Map();
    register(urn, info) {
        this.byUrn.set(urn, info);
    }
    get(urn) {
        return this.byUrn.get(urn);
    }
    primeNameOf(iri) {
        return this.byUrn.get(iri)?.primeName;
    }
    /** Molecule depth of a referenced concept; unknown URNs contribute 0 (documented in DEVIATIONS.md D6). */
    depthOf(urn) {
        return this.byUrn.get(urn)?.moleculeDepth ?? 0;
    }
    get size() {
        return this.byUrn.size;
    }
    entries() {
        return this.byUrn.entries();
    }
}
