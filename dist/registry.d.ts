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
export type StatusName = 'Prime' | 'Molecule' | 'Explicated' | 'AxiomsOnly';
export interface ConceptInfo {
    status: StatusName;
    /** Canonical prime name (primes.ts) when status is Prime. */
    primeName?: string;
    /**
     * Molecule depth (§3.5 rule 5): primes and explicated molecule-free
     * concepts are 0; a molecule is 1 + the max depth of what it references.
     */
    moleculeDepth: number;
}
export declare class ConceptRegistry {
    private readonly byUrn;
    register(urn: string, info: ConceptInfo): void;
    get(urn: string): ConceptInfo | undefined;
    primeNameOf(iri: string): string | undefined;
    /** Molecule depth of a referenced concept; unknown URNs contribute 0 (documented in DEVIATIONS.md D6). */
    depthOf(urn: string): number;
    get size(): number;
    entries(): IterableIterator<[string, ConceptInfo]>;
}
