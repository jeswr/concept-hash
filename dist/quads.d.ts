/**
 * Quad model + literal normalization (§6 step 3) + RDFC-1.0 wrapper +
 * first-degree-hash computation (§6 step 1's duplicate-FDH rule).
 *
 * RDF parsing is done by N3.js; canonicalization by rdf-canonize (the
 * audited digitalbazaar RDFC-1.0 implementation). Nothing here hand-parses
 * RDF syntax; per-quad N-Quads serialization for FDHs reuses rdf-canonize's
 * own `NQuads.serializeQuad` so FDH bytes match the canonicalizer's.
 */
import type * as RDF from '@rdfjs/types';
import { type CanonizeQuad } from 'rdf-canonize';
export type Term = {
    termType: 'NamedNode';
    value: string;
} | {
    termType: 'BlankNode';
    value: string;
} | {
    termType: 'Literal';
    value: string;
    datatype: string;
    language: string;
} | {
    termType: 'DefaultGraph';
    value: '';
};
export interface Quad {
    subject: Term;
    predicate: Term;
    object: Term;
    graph: Term;
}
export declare const namedNode: (value: string) => Term;
export declare const blankNode: (value: string) => Term;
export declare const literal: (value: string, datatype?: string, language?: string) => Term;
export declare const defaultGraph: () => Term;
export declare function termEquals(a: Term, b: Term): boolean;
/** Convert an RDF/JS quad (e.g. from N3) to the plain model. */
export declare function fromRdfjs(q: RDF.Quad): Quad;
export declare function toCanonizeQuad(q: Quad): CanonizeQuad;
/**
 * Normalize one literal per §6 step 3: NFC everywhere; canonical XSD 1.1
 * lexical forms for integer/nonNegativeInteger/decimal/double/boolean;
 * language tags lowercased (deliberate BCP47 divergence, stated in the doc).
 * Invalid lexical forms for the whitelisted datatypes fail closed.
 */
export declare function normalizeLiteral(t: Term & {
    termType: 'Literal';
}): Term & {
    termType: 'Literal';
};
/** True iff the literal is already in the normalized form (verify-side check, §7). */
export declare function isLiteralCanonical(t: Term & {
    termType: 'Literal';
}): boolean;
/** Normalize every literal (and NFC every IRI) in a quad set. */
export declare function normalizeQuads(quads: Quad[]): Quad[];
/**
 * Canonicalize a quad set with RDFC-1.0 (SHA-256 internal digest,
 * rdf-canonize's default fail-closed work factor as the poison-graph
 * backstop). Returns the canonical N-Quads string.
 */
export declare function canonicalNQuads(quads: Quad[]): Promise<string>;
/**
 * Compute the RDFC-1.0 first-degree hash for every blank node in the quad
 * set (RDFC-1.0 §4.6 Hash First Degree Quads): for blank node b, serialize
 * every quad mentioning b with b as `_:a` and every other blank node as
 * `_:z`, sort, concatenate, SHA-256.
 */
export declare function firstDegreeHashes(quads: Quad[]): Map<string, string>;
/**
 * The duplicate-FDH gate rule (§6 step 1), implemented as bounded
 * WL-style color refinement — DEVIATIONS.md D8.
 *
 * The doc's literal rule ("any two blank nodes sharing a first-degree hash
 * ⇒ reject") rejects the doc's OWN §3.3/§3.4 golden records: every
 * `[ cdef:ref "n" ]` coreference-mention node has an identical one-quad
 * subtree, so any record mentioning a referent twice trips it. The rule's
 * *purpose* is to keep hostile records out of RDFC's Hash-N-Degree-Quads
 * permutation search; the class that fuels that search is blank nodes that
 * are locally AUTOMORPHIC — indistinguishable no matter how far you look.
 *
 * So: start from every bnode's RDFC first-degree hash, then refine each
 * color with its neighbours' colors (quad-position-aware) for a bounded
 * number of rounds (or until the partition stabilizes). Bnodes still
 * sharing a color are genuinely automorphic within the bound — e.g.
 * byte-identical sibling subtrees, which ARE redundant assertions — and the
 * record is rejected with the doc's error code. Coreference mentions under
 * distinct parents separate in one or two rounds and are accepted.
 */
export declare function assertNoDuplicateFdh(quads: Quad[]): void;
