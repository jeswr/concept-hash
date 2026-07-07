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
/**
 * Validate a grounding note; returns the linked-reference URNs it carries
 * (they participate in the dependency graph and the molecule nesting bound).
 */
export declare function checkGroundingNote(raw: string): Set<string>;
