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
import { type PrimeEntry } from './primes.js';
export declare const primeSymbolicName: (name: string) => string;
/** Build the authored record (quads) for one prime lexicon entry. */
export declare function primeRecord(entry: PrimeEntry): AuthoredRecord;
/** The full 65-record standard prime mint set, in chart order. */
export declare function standardPrimeMintSet(): AuthoredRecord[];
