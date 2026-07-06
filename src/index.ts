// AUTHORED-BY Claude Fable 5
/**
 * @jeswr/concept-hash — content-addressed concept hasher (profile-1,
 * `urn:concept-def:1`). Public API surface.
 */

export { checkExplicationGrammar } from './grammar.js';
export { checkGroundingNote } from './grounding.js';
export type { RdfFormat } from './io.js';
export { formatForPath, MAX_INPUT_BYTES, parseRdf } from './io.js';
export type { AuthoredRecord, MintedRecord, MintOptions, MintResult } from './mint.js';
export { mint, tarjanSccs } from './mint.js';
export type { PrimeEntry } from './primes.js';
export { CHART_EDITION_PIN, PRIME_BY_INDEX, PRIME_BY_NAME, PRIMES } from './primes.js';
export { primeRecord, primeSymbolicName, standardPrimeMintSet } from './primeset.js';
export type { Quad, Term } from './quads.js';
export {
  assertNoDuplicateFdh,
  blankNode,
  canonicalNQuads,
  defaultGraph,
  firstDegreeHashes,
  fromRdfjs,
  isLiteralCanonical,
  literal,
  namedNode,
  normalizeLiteral,
  normalizeQuads,
} from './quads.js';
export type { ExtractedRecord } from './record.js';
export { extractRecord, RecordIndex } from './record.js';
export type { ConceptInfo, StatusName } from './registry.js';
export { ConceptRegistry } from './registry.js';
export type { ParsedUrn } from './urn.js';
export {
  digestToUrn,
  isConceptUrn,
  parseConceptUrn,
  urnToMultibase,
  uvarint,
} from './urn.js';
export { assertLiteralWhitelist, validateRecordShape } from './validate.js';
export type { VerifyOptions, VerifyResult } from './verify.js';
export { verifyServed } from './verify.js';
export {
  CAPS,
  CDEF,
  ConceptHashError,
  DEFAULT_SERVE_HOST,
  ERR,
  INTRA,
  MEMBER_HEADER,
  MINT_SCHEME,
  memberIri,
  PROFILE_HEADER,
  SELF,
  servingPath,
} from './vocab.js';
