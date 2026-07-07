// AUTHORED-BY Claude Fable 5
/**
 * URN emission and parsing (§6 step 10, §7):
 * digest → multihash (sha2-256, code 0x12, length 0x20) → multibase base32
 * (prefix `b`, lowercase, no padding) → `urn:concept:<multibase-multihash>`.
 *
 * Multihash/multibase via the multiformats reference implementation.
 */
import { base32 } from 'multiformats/bases/base32';
import * as Digest from 'multiformats/hashes/digest';
import { CONCEPT_URN_RE, ConceptHashError, ERR } from './vocab.js';
export const SHA2_256_CODE = 0x12;
export const URN_PREFIX = 'urn:concept:';
/** Wrap raw sha2-256 digest bytes into a `urn:concept:` URN. */
export function digestToUrn(raw, code = SHA2_256_CODE) {
    if (code === SHA2_256_CODE && raw.length !== 32) {
        throw new ConceptHashError(ERR.SHAPE, `sha2-256 digest must be 32 bytes, got ${raw.length}`);
    }
    const mh = Digest.create(code, raw);
    return `${URN_PREFIX}${base32.encode(mh.bytes)}`;
}
/** The multibase-multihash segment of a URN (also the /i/<…> serving segment). */
export function urnToMultibase(urn) {
    parseConceptUrn(urn);
    return urn.slice(URN_PREFIX.length);
}
/**
 * Parse + validate a `urn:concept:` URN per §5's fully-anchored reference
 * rule: anchored regex *and* the multibase segment must decode to a
 * well-formed multihash (decode-validated, not regex-only).
 */
export function parseConceptUrn(urn) {
    if (!CONCEPT_URN_RE.test(urn)) {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `not a valid urn:concept: reference: ${urn}`);
    }
    const multibase = urn.slice(URN_PREFIX.length);
    let bytes;
    try {
        bytes = base32.decode(multibase);
    }
    catch (cause) {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `multibase decode failed for ${urn}: ${String(cause)}`);
    }
    let mh;
    try {
        mh = Digest.decode(bytes);
    }
    catch (cause) {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `multihash decode failed for ${urn}: ${String(cause)}`);
    }
    if (mh.digest.length !== mh.size) {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `multihash length mismatch for ${urn}`);
    }
    return { multibase, code: mh.code, digest: mh.digest };
}
/** True iff the string is a valid (decode-validated) concept URN. */
export function isConceptUrn(s) {
    try {
        parseConceptUrn(s);
        return true;
    }
    catch {
        return false;
    }
}
/** Unsigned LEB128 (multiformats uvarint) encoding — §6 step 9. */
export function uvarint(n) {
    if (!Number.isInteger(n) || n < 0) {
        throw new ConceptHashError(ERR.SHAPE, `uvarint requires a non-negative integer, got ${n}`);
    }
    const out = [];
    let v = n;
    while (v >= 0x80) {
        out.push((v & 0x7f) | 0x80);
        v = Math.floor(v / 128);
    }
    out.push(v);
    return Uint8Array.from(out);
}
