/**
 * Structural (closed-shape) validation of an extracted definition record —
 * §6 step 1's shape / caps / reserved-token / literal-whitelist /
 * prime-lexicon checks. Fail-closed throughout.
 *
 * Grammar checks that need prime *identity* (valency, operator arguments,
 * det/quant/mod classes, referent discipline) live in grammar.ts and run at
 * mint after reference resolution; §7 verification runs only this module
 * (shape + caps + reserved tokens), per the doc's verify path.
 */
import type { Quad, Term } from './quads.js';
import { type RecordIndex } from './record.js';
export interface ValidateOptions {
    /** Mint-mode: `urn:x-mint:` symbolic references are legal (pre-resolution). */
    allowSymbolicRefs?: boolean;
}
export interface ValidationSummary {
    status: string;
    /** Concept references found in reference positions (final URNs + symbolics). */
    conceptRefs: Set<string>;
    /** Grounding-note linked refs (always final URNs, §3.5 rule 4). */
    groundingRefs: Set<string>;
    /** Explication root bnode, when present. */
    explication: Term | undefined;
}
/**
 * Validate one extracted record's closed shape. Returns a summary used by
 * dependency-graph construction and grammar checking.
 */
export declare function validateRecordShape(ix: RecordIndex, options?: ValidateOptions): ValidationSummary;
/**
 * Check a concept-reference position (§5's fully-anchored rule): a final
 * `urn:concept:` URN (decode-validated), `#self`, or — mint-mode only — a
 * symbolic `urn:x-mint:` name.
 */
export declare function checkConceptRef(t: Term, allowSymbolic: boolean, refs: Set<string>): void;
export declare function assertLiteralWhitelist(quads: Quad[]): void;
