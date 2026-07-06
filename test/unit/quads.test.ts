// AUTHORED-BY Claude Fable 5
import { describe, expect, it } from 'vitest';
import {
  assertNoDuplicateFdh,
  blankNode,
  defaultGraph,
  firstDegreeHashes,
  isLiteralCanonical,
  literal,
  namedNode,
  normalizeLiteral,
  type Quad,
} from '../../src/quads.js';

const XSD = 'http://www.w3.org/2001/XMLSchema#';

const lit = (value: string, datatype: string, language = '') => {
  const t = literal(value, datatype, language);
  if (t.termType !== 'Literal') throw new Error('unreachable');
  return t;
};

describe('literal normalization (§6 step 3, canonical XSD 1.1 forms)', () => {
  it('canonicalizes integers (no leading zeros, no plus)', () => {
    expect(normalizeLiteral(lit('007', `${XSD}integer`)).value).toBe('7');
    expect(normalizeLiteral(lit('+42', `${XSD}integer`)).value).toBe('42');
    expect(normalizeLiteral(lit('-042', `${XSD}integer`)).value).toBe('-42');
    expect(normalizeLiteral(lit('-0', `${XSD}integer`)).value).toBe('0');
  });

  it('rejects negative nonNegativeInteger', () => {
    expect(() => normalizeLiteral(lit('-3', `${XSD}nonNegativeInteger`))).toThrow(/ERR_/);
  });

  it('canonicalizes decimals', () => {
    expect(normalizeLiteral(lit('01.100', `${XSD}decimal`)).value).toBe('1.1');
    expect(normalizeLiteral(lit('5', `${XSD}decimal`)).value).toBe('5.0');
    expect(normalizeLiteral(lit('-0.0', `${XSD}decimal`)).value).toBe('0.0');
  });

  it('canonicalizes doubles to scientific form', () => {
    expect(normalizeLiteral(lit('1', `${XSD}double`)).value).toBe('1.0E0');
    expect(normalizeLiteral(lit('0.5', `${XSD}double`)).value).toBe('5.0E-1');
    expect(normalizeLiteral(lit('0', `${XSD}double`)).value).toBe('0.0E0');
  });

  it('canonicalizes booleans', () => {
    expect(normalizeLiteral(lit('1', `${XSD}boolean`)).value).toBe('true');
    expect(normalizeLiteral(lit('0', `${XSD}boolean`)).value).toBe('false');
    expect(() => normalizeLiteral(lit('yes', `${XSD}boolean`))).toThrow(/ERR_/);
  });

  it('lowercases language tags (deliberate BCP47 divergence, §6 step 3)', () => {
    expect(normalizeLiteral(lit('x', `${XSD}string`, 'EN-GB')).language).toBe('en-gb');
  });

  it('applies NFC to string values', () => {
    const nfd = 'cafe\u0301';
    expect(normalizeLiteral(lit(nfd, `${XSD}string`)).value).toBe('caf\u00e9');
  });

  it('isLiteralCanonical detects non-canonical forms', () => {
    expect(isLiteralCanonical(lit('07', `${XSD}nonNegativeInteger`))).toBe(false);
    expect(isLiteralCanonical(lit('7', `${XSD}nonNegativeInteger`))).toBe(true);
    expect(isLiteralCanonical(lit('x', `${XSD}string`, 'EN'))).toBe(false);
  });
});

describe('first-degree hashes + the duplicate-FDH gate', () => {
  const g = defaultGraph();
  const q = (s: Quad['subject'], p: string, o: Quad['object']): Quad => ({
    subject: s,
    predicate: namedNode(p),
    object: o,
    graph: g,
  });

  it('identical sibling subtrees share an FDH and are rejected', () => {
    const quads: Quad[] = [
      q(namedNode('urn:s'), 'urn:p', blankNode('a')),
      q(namedNode('urn:s'), 'urn:p', blankNode('b')),
      q(blankNode('a'), 'urn:v', literal('same')),
      q(blankNode('b'), 'urn:v', literal('same')),
    ];
    const fdh = firstDegreeHashes(quads);
    expect(fdh.get('a')).toBe(fdh.get('b'));
    expect(() => assertNoDuplicateFdh(quads)).toThrow(/ERR_DUPLICATE_BNODE_FDH/);
  });

  it('graph-position-aware: identical trees in DIFFERENT named graphs do not collide (§6 step 8)', () => {
    const quads: Quad[] = [
      { ...q(namedNode('urn:s'), 'urn:p', blankNode('a')), graph: namedNode('urn:g0') },
      { ...q(blankNode('a'), 'urn:v', literal('same')), graph: namedNode('urn:g0') },
      { ...q(namedNode('urn:s'), 'urn:p', blankNode('b')), graph: namedNode('urn:g1') },
      { ...q(blankNode('b'), 'urn:v', literal('same')), graph: namedNode('urn:g1') },
    ];
    expect(() => assertNoDuplicateFdh(quads)).not.toThrow();
  });
});
