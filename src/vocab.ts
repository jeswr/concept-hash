// AUTHORED-BY Claude Fable 5
/**
 * Profile-1 vocabulary, closed inventories and conformance caps for the
 * content-addressed concept hasher (`urn:concept-def:1`).
 *
 * Everything in this module is conformance-defining: the closed predicate
 * sets, the axiom-relation set, the grammar inventories (§4) and the caps
 * table (§5) of the design doc.
 */

export const PROFILE_HEADER = 'urn:concept-def:1\n';
export const MEMBER_HEADER = 'urn:concept-def:1#member\n';

export const CDEF = 'urn:concept-def:1#';
export const SELF = `${CDEF}self`;
export const INTRA = `${CDEF}intra`;
export const memberIri = (i: number): string => `${CDEF}member-${i}`;

export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDF_TYPE = `${RDF_NS}type`;
export const RDF_FIRST = `${RDF_NS}first`;
export const RDF_REST = `${RDF_NS}rest`;
export const RDF_NIL = `${RDF_NS}nil`;

export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
export const XSD_STRING = `${XSD_NS}string`;
export const XSD_NON_NEG_INT = `${XSD_NS}nonNegativeInteger`;

export const cdef = (local: string): string => `${CDEF}${local}`;

// --- record-level terms ------------------------------------------------------
export const CONCEPT_DEFINITION = cdef('ConceptDefinition');
export const SEMANTIC_STATUS = cdef('semanticStatus');
export const STATUS_PRIME = cdef('Prime');
export const STATUS_MOLECULE = cdef('Molecule');
export const STATUS_EXPLICATED = cdef('Explicated');
export const STATUS_AXIOMS_ONLY = cdef('AxiomsOnly');
export const SEMANTIC_STATUSES = new Set([
  STATUS_PRIME,
  STATUS_MOLECULE,
  STATUS_EXPLICATED,
  STATUS_AXIOMS_ONLY,
]);

export const AXIOM = cdef('axiom');
export const EXPLICATION = cdef('explication');
export const GROUNDING_NOTE = cdef('groundingNote');
export const PRIME_CATEGORY = cdef('primeCategory');
export const CHART_EDITION = cdef('chartEdition');
export const CHART_INDEX = cdef('chartIndex');
export const EXPONENT = cdef('exponent');

// --- axiom terms --------------------------------------------------------------
export const REL = cdef('rel');
export const TARGET = cdef('target');
export const AXIOM_RELATIONS = new Set(
  [
    'subClassOf',
    'subPropertyOf',
    'domain',
    'range',
    'disjointWith',
    'metaType',
    'propertyKind',
    'restriction',
    'bridgesTo',
  ].map(cdef),
);
export const REL_PROPERTY_KIND = cdef('propertyKind');
export const REL_BRIDGES_TO = cdef('bridgesTo');
export const REL_RESTRICTION = cdef('restriction');
export const PROPERTY_KIND_TOKENS = new Set([cdef('DatatypeProperty'), cdef('ObjectProperty')]);

// Restriction node structure (doc gap — see DEVIATIONS.md D1): the doc closes
// the relation set with `restriction` and whitelists "restriction cardinalities"
// as literals but never defines the restriction node's shape. Profile-1 as
// implemented pins it to:
//   [ cdef:onProperty <concept-ref> ;
//     (cdef:minCardinality | cdef:maxCardinality | cdef:cardinality "n"^^xsd:nonNegativeInteger)* ;
//     (cdef:allValuesFrom | cdef:someValuesFrom <concept-ref>)? ]
export const ON_PROPERTY = cdef('onProperty');
export const MIN_CARDINALITY = cdef('minCardinality');
export const MAX_CARDINALITY = cdef('maxCardinality');
export const CARDINALITY = cdef('cardinality');
export const ALL_VALUES_FROM = cdef('allValuesFrom');
export const SOME_VALUES_FROM = cdef('someValuesFrom');
export const RESTRICTION_CARDINALITY_PREDICATES = new Set([
  MIN_CARDINALITY,
  MAX_CARDINALITY,
  CARDINALITY,
]);
export const RESTRICTION_VALUE_PREDICATES = new Set([ALL_VALUES_FROM, SOME_VALUES_FROM]);

// --- explication terms (§4) ---------------------------------------------------
export const FRAME = cdef('frame');
export const FRAME_INSTANCE_SCHEMA = cdef('InstanceSchema');
export const FRAME_WHEN_TRUE = cdef('WhenTrue');
export const FRAME_RELATIONAL_SCHEMA = cdef('RelationalSchema');
export const FRAMES = new Set([FRAME_INSTANCE_SCHEMA, FRAME_WHEN_TRUE, FRAME_RELATIONAL_SCHEMA]);

export const REFERENTS = cdef('referents');
export const REF_INDEX = cdef('refIndex');
export const REF_KIND = cdef('refKind');
export const REF_KINDS = new Set(
  ['SomeoneRef', 'SomethingRef', 'TimeRef', 'PlaceRef', 'ClauseRef'].map(cdef),
);
export const CLAUSES = cdef('clauses');
export const QUOTE_CLAUSES = cdef('quoteClauses');

export const PRED = cdef('pred');
export const OP = cdef('op');
export const SLOT = cdef('slot');
export const ADJUNCT = cdef('adjunct');
export const ROLE = cdef('role');
export const FILLER = cdef('filler');
export const SCOPE = cdef('scope');
export const ANCHOR = cdef('anchor');
export const ANTECEDENT = cdef('antecedent');
export const CONSEQUENT = cdef('consequent');
export const CAUSE = cdef('cause');
export const EFFECT = cdef('effect');

// substantive-phrase terms (§4.3)
export const DET = cdef('det');
export const QUANT = cdef('quant');
export const MOD = cdef('mod');
export const HEAD = cdef('head');
export const OF = cdef('of');
export const REF = cdef('ref');
export const BIND = cdef('bind');
export const RESTRICTED_BY = cdef('restrictedBy');

/** Closed slot-role inventory (§4.4). */
export const SLOT_ROLES = new Set(
  [
    'agent',
    'undergoer',
    'experiencer',
    'stimulus',
    'addressee',
    'topic',
    'quote',
    'complement',
    'attribute',
    'locus',
    'possessor',
    'instrument',
    'comitative',
  ].map(cdef),
);
/** Closed adjunct-role inventory (§4.4). */
export const ADJUNCT_ROLES = new Set(['time', 'duration', 'place', 'manner'].map(cdef));

/**
 * Predicate valency frames (§4.4), keyed by prime name.
 * `req` slots must be present; every present slot role must be in `req ∪ opt`.
 */
export const VALENCY: Record<string, { req: string[]; opt: string[] }> = {
  DO: { req: ['agent'], opt: ['undergoer', 'instrument', 'comitative'] },
  HAPPEN: { req: [], opt: ['undergoer'] },
  MOVE: { req: ['undergoer'], opt: [] },
  THINK: { req: ['experiencer'], opt: ['topic', 'quote'] },
  KNOW: { req: ['experiencer'], opt: ['topic', 'complement'] },
  WANT: { req: ['experiencer', 'complement'], opt: [] },
  "DON'T-WANT": { req: ['experiencer', 'complement'], opt: [] },
  FEEL: { req: ['experiencer'], opt: ['attribute'] },
  SEE: { req: ['experiencer', 'stimulus'], opt: [] },
  HEAR: { req: ['experiencer', 'stimulus'], opt: [] },
  SAY: { req: ['agent'], opt: ['addressee', 'topic', 'quote'] },
  TRUE: { req: ['undergoer'], opt: [] },
  'BE-SOMEWHERE': { req: ['undergoer', 'locus'], opt: [] },
  'THERE-IS': { req: ['undergoer'], opt: [] },
  'BE-SPEC': { req: ['undergoer', 'attribute'], opt: [] },
  'IS-MINE': { req: ['undergoer', 'possessor'], opt: [] },
  LIVE: { req: ['undergoer'], opt: [] },
  DIE: { req: ['undergoer'], opt: [] },
};

/**
 * Operator inventory (§4.5) with the clause-argument predicates each licenses.
 * WHEN and LIKE reuse anchor/scope (doc gap — DEVIATIONS.md D2).
 */
export const OPERATORS: Record<string, { req: string[]; opt: string[] }> = {
  NOT: { req: [SCOPE], opt: [] },
  CAN: { req: [SCOPE], opt: [] },
  MAYBE: { req: [SCOPE], opt: [] },
  IF: { req: [ANTECEDENT, CONSEQUENT], opt: [] },
  BECAUSE: { req: [CAUSE, EFFECT], opt: [] },
  WHEN: { req: [ANCHOR, SCOPE], opt: [] },
  LIKE: { req: [ANCHOR, SCOPE], opt: [] },
  // AFTER/BEFORE: "anchor and scope; also usable as a time-adjunct filler with
  // anchor only" — scope is therefore optional at the operator level and the
  // no-scope form is only legal in filler position (checked in grammar.ts).
  AFTER: { req: [ANCHOR], opt: [SCOPE] },
  BEFORE: { req: [ANCHOR], opt: [SCOPE] },
};

/** Determiner primes usable in the SP `det` position (§4.3). */
export const DET_PRIMES = new Set(['THIS', 'THE-SAME', 'OTHER~ELSE~ANOTHER', 'SOME']);
/** Quantifier primes usable in the SP `quant` position (§4.3). */
export const QUANT_PRIMES = new Set(['ONE', 'TWO', 'SOME', 'ALL', 'MUCH~MANY', 'LITTLE~FEW']);
/** Modifier primes usable in the SP `mod` position (§4.3). */
export const MOD_PRIMES = new Set(['GOOD', 'BAD', 'BIG', 'SMALL']);
/** Substantive primes usable as SP heads (§4.3). */
export const SUBSTANTIVE_PRIMES = new Set([
  'I',
  'YOU',
  'SOMEONE',
  'SOMETHING~THING',
  'PEOPLE',
  'BODY',
  'KIND',
  'PART',
  'WHEN~TIME',
  'WHERE~PLACE',
  'WORDS',
]);
/** 0-ary indexical / duration primes usable directly as fillers (§4.5). */
export const FILLER_PRIMES = new Set([
  'NOW',
  'HERE',
  'I',
  'YOU',
  'A-LONG-TIME',
  'A-SHORT-TIME',
  'FOR-SOME-TIME',
  'MOMENT',
  'BEFORE',
  'AFTER',
  'GOOD',
  'BAD',
  'PEOPLE',
  'SOMEONE',
  'SOMETHING~THING',
]);

// --- caps (§5, profile-1 conformance constants) --------------------------------
export const CAPS = {
  /** Max canonical record size in bytes. */
  maxCanonicalBytes: 65_536,
  /** Total blank nodes per record (incl. rdf:List cells). */
  maxTotalBnodes: 256,
  /** Non-list (structural) blank nodes. */
  maxStructuralBnodes: 64,
  /** Structural nesting depth (list spines excluded). */
  maxNestingDepth: 12,
  /** Any rdf:List length. */
  maxListLength: 64,
  /** Clauses per explication (incl. quote clauses). */
  maxClauses: 32,
  /** Referents per explication. */
  maxReferents: 32,
  /** Exponents per prime. */
  maxExponents: 4,
  /** Grounding note bytes (NFC, UTF-8). */
  maxGroundingNoteBytes: 1_024,
  /** Molecule nesting depth. */
  maxMoleculeDepth: 4,
  /** SCC size. */
  maxSccSize: 32,
} as const;

/** Reference syntax for final concept URNs (§5): anchored, then decode-validated. */
export const CONCEPT_URN_RE = /^urn:concept:b[a-z2-7]{20,128}$/;

/** Symbolic (pre-resolution) mint-set reference scheme used by this implementation. */
export const MINT_SCHEME = 'urn:x-mint:';

/** Default HTTPS serving host (§7): the codegen immutable serve plane. */
export const DEFAULT_SERVE_HOST = 'models.jeswr.org';
export const servingPath = (multibase: string, host = DEFAULT_SERVE_HOST): string =>
  `https://${host}/i/${multibase}`;

/** Prime category tokens (profile IRIs; categories per §4.1 / primes.ts). */
export const PRIME_CATEGORY_TOKENS = new Set(
  [
    'Substantive',
    'RelationalSubstantive',
    'Determiner',
    'Quantifier',
    'Evaluator',
    'Descriptor',
    'MentalPredicate',
    'Speech',
    'Action',
    'LocationExistence',
    'LifeDeath',
    'Time',
    'Space',
    'Logical',
    'Intensifier',
    'Similarity',
  ].map(cdef),
);

/**
 * Every profile-vocabulary IRI that may legitimately appear in a record.
 * Any other IRI under `urn:concept-def:` (except #self) is RESERVED (§5) —
 * ERR_RESERVED_TOKEN at the gate; verifiers re-apply the reservation,
 * permitting #member-i only in the graph-name positions §6 step 8 generates.
 */
export const ALL_PROFILE_TERMS: ReadonlySet<string> = new Set([
  CONCEPT_DEFINITION,
  SEMANTIC_STATUS,
  ...SEMANTIC_STATUSES,
  AXIOM,
  EXPLICATION,
  GROUNDING_NOTE,
  PRIME_CATEGORY,
  CHART_EDITION,
  CHART_INDEX,
  EXPONENT,
  REL,
  TARGET,
  ...AXIOM_RELATIONS,
  ...PROPERTY_KIND_TOKENS,
  ON_PROPERTY,
  MIN_CARDINALITY,
  MAX_CARDINALITY,
  CARDINALITY,
  ALL_VALUES_FROM,
  SOME_VALUES_FROM,
  FRAME,
  ...FRAMES,
  REFERENTS,
  REF_INDEX,
  REF_KIND,
  ...REF_KINDS,
  CLAUSES,
  QUOTE_CLAUSES,
  PRED,
  OP,
  SLOT,
  ADJUNCT,
  ROLE,
  FILLER,
  SCOPE,
  ANCHOR,
  ANTECEDENT,
  CONSEQUENT,
  CAUSE,
  EFFECT,
  DET,
  QUANT,
  MOD,
  HEAD,
  OF,
  REF,
  BIND,
  RESTRICTED_BY,
  ...SLOT_ROLES,
  ...ADJUNCT_ROLES,
  ...PRIME_CATEGORY_TOKENS,
]);

/** Error codes (doc-named ones use the doc's spelling). */
export const ERR = {
  PRIME_LEXICON_MISMATCH: 'ERR_PRIME_LEXICON_MISMATCH',
  GROUNDING_LEXICON: 'ERR_GROUNDING_LEXICON',
  DUPLICATE_BNODE_FDH: 'ERR_DUPLICATE_BNODE_FDH',
  SYMMETRIC_SCC: 'ERR_SYMMETRIC_SCC',
  SHAPE: 'ERR_SHAPE',
  CAPS: 'ERR_CAPS',
  RESERVED_TOKEN: 'ERR_RESERVED_TOKEN',
  REFERENCE_SYNTAX: 'ERR_REFERENCE_SYNTAX',
  UNRESOLVABLE_REFERENCE: 'ERR_UNRESOLVABLE_REFERENCE',
  GRAMMAR: 'ERR_GRAMMAR',
  MOLECULE_DEPTH: 'ERR_MOLECULE_DEPTH',
  VERIFY: 'ERR_VERIFY',
  NOT_CANONICAL: 'ERR_NOT_CANONICAL',
} as const;

/** A gate/verify failure. Fail-closed everywhere: throw, never warn. */
export class ConceptHashError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ConceptHashError';
    this.code = code;
  }
}
