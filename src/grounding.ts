// AUTHORED-BY Claude Fable 5
/**
 * Molecule grounding notes (§3.5): the controlled grounding lexicon.
 *
 * After NFC normalization and tokenization, every token must be (a) a prime
 * exponent (incl. its closed inflected / function-word allolexes — pinned in
 * primes.ts), (b) punctuation from a closed set, (c) the literal `[m]`
 * molecule flag, or (d) a linked reference `{urn:concept:<mb-multihash>|gloss}`
 * whose gloss is display text anchored to the ref. A bare content word that
 * is neither is ERR_GROUNDING_LEXICON at the gate.
 *
 * Linked refs must be final `urn:concept:` URNs (decode-validated) — never
 * aliases, never intra-mint-set (§3.5 rule 4).
 */

import { GROUNDING_LEXICON, GROUNDING_PUNCTUATION, MOLECULE_FLAG_TOKEN } from './primes.js';
import { parseConceptUrn } from './urn.js';
import { CAPS, ConceptHashError, ERR } from './vocab.js';

const LINKED_REF_RE = /\{(urn:concept:[a-z2-7]+)\|([^{}|]{1,256})\}/g;

/**
 * Validate a grounding note; returns the linked-reference URNs it carries
 * (they participate in the dependency graph and the molecule nesting bound).
 */
export function checkGroundingNote(raw: string): Set<string> {
  const note = raw.normalize('NFC');
  const bytes = Buffer.byteLength(note, 'utf8');
  if (bytes > CAPS.maxGroundingNoteBytes) {
    throw new ConceptHashError(
      ERR.CAPS,
      `grounding note is ${bytes} bytes NFC (cap ${CAPS.maxGroundingNoteBytes}, §3.5)`,
    );
  }
  if (note.includes('\u0000')) {
    throw new ConceptHashError(ERR.GROUNDING_LEXICON, 'grounding note contains a NUL byte');
  }

  const refs = new Set<string>();
  // Extract linked references first; each must decode-validate as a concept URN.
  let stripped = '';
  let last = 0;
  for (const m of note.matchAll(LINKED_REF_RE)) {
    const [, urn] = m;
    if (urn === undefined) continue;
    try {
      parseConceptUrn(urn);
    } catch (cause) {
      throw new ConceptHashError(
        ERR.GROUNDING_LEXICON,
        `grounding-note linked ref ${urn} is not a valid final urn:concept: URN (§3.5 rule 4): ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    refs.add(urn);
    stripped += `${note.slice(last, m.index)} `;
    last = m.index + m[0].length;
  }
  stripped += note.slice(last);

  // Any brace left over is a malformed linked reference.
  if (stripped.includes('{') || stripped.includes('}') || stripped.includes('|')) {
    throw new ConceptHashError(
      ERR.GROUNDING_LEXICON,
      'malformed linked reference in grounding note — the only legal brace form is {urn:concept:…|gloss}',
    );
  }

  for (const rawToken of stripped.split(/\s+/)) {
    if (rawToken === '') continue;
    if (rawToken === MOLECULE_FLAG_TOKEN) continue;
    // strip closed punctuation from token edges (e.g. "kind;" / "(very")
    let token = rawToken;
    while (token.length > 0) {
      const first = token[0];
      if (first !== undefined && GROUNDING_PUNCTUATION.has(first)) token = token.slice(1);
      else break;
    }
    while (token.length > 0) {
      const lastCh = token[token.length - 1];
      if (lastCh !== undefined && GROUNDING_PUNCTUATION.has(lastCh)) token = token.slice(0, -1);
      else break;
    }
    if (token === '') continue;
    if (!GROUNDING_LEXICON.has(token.toLowerCase())) {
      throw new ConceptHashError(
        ERR.GROUNDING_LEXICON,
        `grounding-note token ${JSON.stringify(token)} is not a prime exponent, closed allolex, punctuation, [m], or linked ref (§3.5 rule 3)`,
      );
    }
  }
  return refs;
}
