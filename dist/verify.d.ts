/**
 * Verify-by-recompute (§7 of the design doc, byte-pinned):
 *
 * - select the path from the served form: a single default-graph record ⇒
 *   singleton; a named-graph dataset ⇒ component; anything else ⇒ reject
 * - served bytes must already be canonical — non-NFC / non-canonical-lexical /
 *   non-lowercase-langtag content is REJECTED, never normalized; for
 *   application/n-quads the served bytes must equal the canonical bytes
 * - singleton: shape+caps+reserved-token check → recompute §6 step 5 →
 *   byte-compare
 * - component: ≤32 named graphs named exactly #member-0…#member-(n−1),
 *   contiguous, default graph empty, each graph record-shaped within caps →
 *   recompute §6 steps 8–9 (which yields EVERY member URN) → the requested
 *   URN must be in that set. The canonical member ordering (steps 6–7) is
 *   re-checked (DEVIATIONS.md D7).
 *
 * Verification is structural-only (no §4 grammar pass) per the doc's §7.
 */
import { type Quad } from './quads.js';
export interface VerifyOptions {
    /**
     * When the served bytes are application/n-quads, pass them here for the
     * exact byte-compare (the strongest §7 check).
     */
    servedNQuads?: string;
}
export interface VerifyResult {
    ok: true;
    kind: 'singleton' | 'component-member' | 'component';
    urn: string;
    componentUrn?: string;
    memberIndex?: number;
    memberUrns?: string[];
}
/**
 * Verify a served definition representation against a requested URN.
 * Throws ConceptHashError (fail closed) on any mismatch.
 */
export declare function verifyServed(urn: string, quads: Quad[], options?: VerifyOptions): Promise<VerifyResult>;
