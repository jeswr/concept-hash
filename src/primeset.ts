// AUTHORED-BY Claude Fable 5
/**
 * Programmatic construction of the 65 authored prime records (existence
 * proof 0, §3.2) from the pinned lexicon table, as a mint set. Minting them
 * yields the standard prime set — the ordered list of 65 prime URNs a
 * federation snapshot pins (§8).
 *
 * Symbolic names are `prime:<NAME>` (e.g. `prime:KIND`), so the standard
 * alias table maps `prime:KIND` → its minted URN.
 */

import type { AuthoredRecord } from './mint.js';
import { CHART_EDITION_PIN, PRIMES, type PrimeEntry } from './primes.js';
import { blankNode, defaultGraph, literal, namedNode, type Quad, type Term } from './quads.js';
import {
  CHART_EDITION,
  CHART_INDEX,
  CONCEPT_DEFINITION,
  cdef,
  EXPONENT,
  MINT_SCHEME,
  PRIME_CATEGORY,
  RDF_FIRST,
  RDF_NIL,
  RDF_REST,
  RDF_TYPE,
  SEMANTIC_STATUS,
  STATUS_PRIME,
  XSD_NON_NEG_INT,
} from './vocab.js';

export const primeSymbolicName = (name: string): string => `prime:${name}`;

/** Build the authored record (quads) for one prime lexicon entry. */
export function primeRecord(entry: PrimeEntry): AuthoredRecord {
  const name = primeSymbolicName(entry.name);
  const focus = namedNode(`${MINT_SCHEME}${name}`);
  const g = defaultGraph();
  const quads: Quad[] = [];
  const q = (subject: Term, predicate: string, object: Term): void => {
    quads.push({ subject, predicate: namedNode(predicate), object, graph: g });
  };
  q(focus, RDF_TYPE, namedNode(CONCEPT_DEFINITION));
  q(focus, SEMANTIC_STATUS, namedNode(STATUS_PRIME));
  q(focus, PRIME_CATEGORY, namedNode(cdef(entry.category)));
  q(focus, CHART_EDITION, literal(CHART_EDITION_PIN));
  q(focus, CHART_INDEX, literal(String(entry.chartIndex), XSD_NON_NEG_INT));
  // ordered exponent list
  let cell: Term = namedNode(RDF_NIL);
  for (let i = entry.exponents.length - 1; i >= 0; i--) {
    const value = entry.exponents[i];
    if (value === undefined) continue;
    const b = blankNode(`exp-${entry.chartIndex}-${i}`);
    q(b, RDF_FIRST, literal(value));
    q(b, RDF_REST, cell);
    cell = b;
  }
  q(focus, EXPONENT, cell);
  return { name, quads };
}

/** The full 65-record standard prime mint set, in chart order. */
export function standardPrimeMintSet(): AuthoredRecord[] {
  return PRIMES.map(primeRecord);
}
