// AUTHORED-BY Claude Fable 5

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  digestToUrn,
  isConceptUrn,
  parseConceptUrn,
  urnToMultibase,
  uvarint,
} from '../../src/urn.js';

describe('urn emission (§6 step 10)', () => {
  const digest = new Uint8Array(createHash('sha256').update('hello').digest());

  it('emits urn:concept:<base32-multihash> with sha2-256 code 0x12 length 0x20', () => {
    const urn = digestToUrn(digest);
    expect(urn).toMatch(/^urn:concept:b[a-z2-7]+$/);
    const parsed = parseConceptUrn(urn);
    expect(parsed.code).toBe(0x12);
    expect(Buffer.from(parsed.digest)).toEqual(Buffer.from(digest));
  });

  it('round-trips through urnToMultibase', () => {
    const urn = digestToUrn(digest);
    expect(`urn:concept:${urnToMultibase(urn)}`).toBe(urn);
  });

  it('rejects wrong-length digests', () => {
    expect(() => digestToUrn(new Uint8Array(16))).toThrow(/ERR_/);
  });

  it('decode-validates, not regex-only (§5): base32-legal garbage is rejected', () => {
    expect(isConceptUrn('urn:concept:baaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
  });

  it('rejects uppercase, padding, wrong multibase prefix, and short segments', () => {
    expect(isConceptUrn('urn:concept:BCIQAAA')).toBe(false);
    expect(isConceptUrn('urn:concept:zabcdefabcdefabcdefabcdef')).toBe(false);
    expect(isConceptUrn('urn:concept:babc')).toBe(false);
    expect(isConceptUrn('urn:concept-def:1#self')).toBe(false);
  });

  it('uvarint is unsigned LEB128', () => {
    expect([...uvarint(0)]).toEqual([0]);
    expect([...uvarint(1)]).toEqual([1]);
    expect([...uvarint(127)]).toEqual([127]);
    expect([...uvarint(128)]).toEqual([0x80, 0x01]);
    expect([...uvarint(300)]).toEqual([0xac, 0x02]);
    expect(() => uvarint(-1)).toThrow(/ERR_/);
  });
});
