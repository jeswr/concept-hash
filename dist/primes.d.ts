/**
 * The pinned prime lexicon table — the 65 NSM semantic primes of chart
 * edition NSM-EN-v20-2022, typed by category, in chart order (§4.1 of the
 * design doc). A prime record must byte-match this table
 * (ERR_PRIME_LEXICON_MISMATCH otherwise).
 *
 * Chart indices are 1-based positions in the §4.1 listing; this matches the
 * doc's normative KIND example (chartIndex 7).
 *
 * Names: a prime's `name` is its `~`-joined allolex set as written in §4.1
 * (e.g. `SOMETHING~THING`); its `exponents` are the ordered allolexes.
 */
export declare const CHART_EDITION_PIN = "NSM-EN-v20-2022";
export interface PrimeEntry {
    /** Canonical name (allolexes ~-joined, §4.1 spelling). */
    name: string;
    /** Profile category token (local name under cdef:). */
    category: string;
    /** 1-based chart index. */
    chartIndex: number;
    /** Ordered canonical English exponent list (allolexes in chart order). */
    exponents: string[];
}
export declare const PRIMES: readonly PrimeEntry[];
export declare const PRIME_BY_NAME: ReadonlyMap<string, PrimeEntry>;
export declare const PRIME_BY_INDEX: ReadonlyMap<number, PrimeEntry>;
export declare const GROUNDING_LEXICON: ReadonlySet<string>;
/** Closed punctuation set for grounding notes (matched per-character). */
export declare const GROUNDING_PUNCTUATION: ReadonlySet<string>;
/** The literal molecule-flag token, admitted verbatim in grounding notes. */
export declare const MOLECULE_FLAG_TOKEN = "[m]";
