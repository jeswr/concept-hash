/**
 * URN emission and parsing (§6 step 10, §7):
 * digest → multihash (sha2-256, code 0x12, length 0x20) → multibase base32
 * (prefix `b`, lowercase, no padding) → `urn:concept:<multibase-multihash>`.
 *
 * Multihash/multibase via the multiformats reference implementation.
 */
export declare const SHA2_256_CODE = 18;
export declare const URN_PREFIX = "urn:concept:";
/** Wrap raw sha2-256 digest bytes into a `urn:concept:` URN. */
export declare function digestToUrn(raw: Uint8Array, code?: number): string;
/** The multibase-multihash segment of a URN (also the /i/<…> serving segment). */
export declare function urnToMultibase(urn: string): string;
export interface ParsedUrn {
    multibase: string;
    /** multihash function code (varint-decoded). */
    code: number;
    /** raw digest bytes. */
    digest: Uint8Array;
}
/**
 * Parse + validate a `urn:concept:` URN per §5's fully-anchored reference
 * rule: anchored regex *and* the multibase segment must decode to a
 * well-formed multihash (decode-validated, not regex-only).
 */
export declare function parseConceptUrn(urn: string): ParsedUrn;
/** True iff the string is a valid (decode-validated) concept URN. */
export declare function isConceptUrn(s: string): boolean;
/** Unsigned LEB128 (multiformats uvarint) encoding — §6 step 9. */
export declare function uvarint(n: number): Uint8Array;
