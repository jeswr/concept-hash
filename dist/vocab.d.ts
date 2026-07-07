/**
 * Profile-1 vocabulary, closed inventories and conformance caps for the
 * content-addressed concept hasher (`urn:concept-def:1`).
 *
 * Everything in this module is conformance-defining: the closed predicate
 * sets, the axiom-relation set, the grammar inventories (§4) and the caps
 * table (§5) of the design doc.
 */
export declare const PROFILE_HEADER = "urn:concept-def:1\n";
export declare const MEMBER_HEADER = "urn:concept-def:1#member\n";
export declare const CDEF = "urn:concept-def:1#";
export declare const SELF = "urn:concept-def:1#self";
export declare const INTRA = "urn:concept-def:1#intra";
export declare const memberIri: (i: number) => string;
export declare const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export declare const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export declare const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
export declare const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";
export declare const RDF_NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";
export declare const XSD_NS = "http://www.w3.org/2001/XMLSchema#";
export declare const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
export declare const XSD_NON_NEG_INT = "http://www.w3.org/2001/XMLSchema#nonNegativeInteger";
export declare const cdef: (local: string) => string;
export declare const CONCEPT_DEFINITION: string;
export declare const SEMANTIC_STATUS: string;
export declare const STATUS_PRIME: string;
export declare const STATUS_MOLECULE: string;
export declare const STATUS_EXPLICATED: string;
export declare const STATUS_AXIOMS_ONLY: string;
export declare const SEMANTIC_STATUSES: Set<string>;
export declare const AXIOM: string;
export declare const EXPLICATION: string;
export declare const GROUNDING_NOTE: string;
export declare const PRIME_CATEGORY: string;
export declare const CHART_EDITION: string;
export declare const CHART_INDEX: string;
export declare const EXPONENT: string;
export declare const REL: string;
export declare const TARGET: string;
export declare const AXIOM_RELATIONS: Set<string>;
export declare const REL_PROPERTY_KIND: string;
export declare const REL_BRIDGES_TO: string;
export declare const REL_RESTRICTION: string;
export declare const PROPERTY_KIND_TOKENS: Set<string>;
export declare const ON_PROPERTY: string;
export declare const MIN_CARDINALITY: string;
export declare const MAX_CARDINALITY: string;
export declare const CARDINALITY: string;
export declare const ALL_VALUES_FROM: string;
export declare const SOME_VALUES_FROM: string;
export declare const RESTRICTION_CARDINALITY_PREDICATES: Set<string>;
export declare const RESTRICTION_VALUE_PREDICATES: Set<string>;
export declare const FRAME: string;
export declare const FRAME_INSTANCE_SCHEMA: string;
export declare const FRAME_WHEN_TRUE: string;
export declare const FRAME_RELATIONAL_SCHEMA: string;
export declare const FRAMES: Set<string>;
export declare const REFERENTS: string;
export declare const REF_INDEX: string;
export declare const REF_KIND: string;
export declare const REF_KINDS: Set<string>;
export declare const CLAUSES: string;
export declare const QUOTE_CLAUSES: string;
export declare const PRED: string;
export declare const OP: string;
export declare const SLOT: string;
export declare const ADJUNCT: string;
export declare const ROLE: string;
export declare const FILLER: string;
export declare const SCOPE: string;
export declare const ANCHOR: string;
export declare const ANTECEDENT: string;
export declare const CONSEQUENT: string;
export declare const CAUSE: string;
export declare const EFFECT: string;
export declare const DET: string;
export declare const QUANT: string;
export declare const MOD: string;
export declare const HEAD: string;
export declare const OF: string;
export declare const REF: string;
export declare const BIND: string;
export declare const RESTRICTED_BY: string;
/** Closed slot-role inventory (§4.4). */
export declare const SLOT_ROLES: Set<string>;
/** Closed adjunct-role inventory (§4.4). */
export declare const ADJUNCT_ROLES: Set<string>;
/**
 * Predicate valency frames (§4.4), keyed by prime name.
 * `req` slots must be present; every present slot role must be in `req ∪ opt`.
 */
export declare const VALENCY: Record<string, {
    req: string[];
    opt: string[];
}>;
/**
 * Operator inventory (§4.5) with the clause-argument predicates each licenses.
 * WHEN and LIKE reuse anchor/scope (doc gap — DEVIATIONS.md D2).
 */
export declare const OPERATORS: Record<string, {
    req: string[];
    opt: string[];
}>;
/** Determiner primes usable in the SP `det` position (§4.3). */
export declare const DET_PRIMES: Set<string>;
/** Quantifier primes usable in the SP `quant` position (§4.3). */
export declare const QUANT_PRIMES: Set<string>;
/** Modifier primes usable in the SP `mod` position (§4.3). */
export declare const MOD_PRIMES: Set<string>;
/** Substantive primes usable as SP heads (§4.3). */
export declare const SUBSTANTIVE_PRIMES: Set<string>;
/** 0-ary indexical / duration primes usable directly as fillers (§4.5). */
export declare const FILLER_PRIMES: Set<string>;
export declare const CAPS: {
    /** Max canonical record size in bytes. */
    readonly maxCanonicalBytes: 65536;
    /** Total blank nodes per record (incl. rdf:List cells). */
    readonly maxTotalBnodes: 256;
    /** Non-list (structural) blank nodes. */
    readonly maxStructuralBnodes: 64;
    /** Structural nesting depth (list spines excluded). */
    readonly maxNestingDepth: 12;
    /** Any rdf:List length. */
    readonly maxListLength: 64;
    /** Clauses per explication (incl. quote clauses). */
    readonly maxClauses: 32;
    /** Referents per explication. */
    readonly maxReferents: 32;
    /** Exponents per prime. */
    readonly maxExponents: 4;
    /** Grounding note bytes (NFC, UTF-8). */
    readonly maxGroundingNoteBytes: 1024;
    /** Molecule nesting depth. */
    readonly maxMoleculeDepth: 4;
    /** SCC size. */
    readonly maxSccSize: 32;
};
/** Reference syntax for final concept URNs (§5): anchored, then decode-validated. */
export declare const CONCEPT_URN_RE: RegExp;
/** Symbolic (pre-resolution) mint-set reference scheme used by this implementation. */
export declare const MINT_SCHEME = "urn:x-mint:";
/** Default HTTPS serving host (§7): the codegen immutable serve plane. */
export declare const DEFAULT_SERVE_HOST = "models.jeswr.org";
export declare const servingPath: (multibase: string, host?: string) => string;
/** Prime category tokens (profile IRIs; categories per §4.1 / primes.ts). */
export declare const PRIME_CATEGORY_TOKENS: Set<string>;
/**
 * Every profile-vocabulary IRI that may legitimately appear in a record.
 * Any other IRI under `urn:concept-def:` (except #self) is RESERVED (§5) —
 * ERR_RESERVED_TOKEN at the gate; verifiers re-apply the reservation,
 * permitting #member-i only in the graph-name positions §6 step 8 generates.
 */
export declare const ALL_PROFILE_TERMS: ReadonlySet<string>;
/** Error codes (doc-named ones use the doc's spelling). */
export declare const ERR: {
    readonly PRIME_LEXICON_MISMATCH: "ERR_PRIME_LEXICON_MISMATCH";
    readonly GROUNDING_LEXICON: "ERR_GROUNDING_LEXICON";
    readonly DUPLICATE_BNODE_FDH: "ERR_DUPLICATE_BNODE_FDH";
    readonly SYMMETRIC_SCC: "ERR_SYMMETRIC_SCC";
    readonly SHAPE: "ERR_SHAPE";
    readonly CAPS: "ERR_CAPS";
    readonly RESERVED_TOKEN: "ERR_RESERVED_TOKEN";
    readonly REFERENCE_SYNTAX: "ERR_REFERENCE_SYNTAX";
    readonly UNRESOLVABLE_REFERENCE: "ERR_UNRESOLVABLE_REFERENCE";
    readonly GRAMMAR: "ERR_GRAMMAR";
    readonly MOLECULE_DEPTH: "ERR_MOLECULE_DEPTH";
    readonly VERIFY: "ERR_VERIFY";
    readonly NOT_CANONICAL: "ERR_NOT_CANONICAL";
};
/** A gate/verify failure. Fail-closed everywhere: throw, never warn. */
export declare class ConceptHashError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
