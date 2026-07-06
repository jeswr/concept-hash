// AUTHORED-BY Claude Fable 5
/**
 * Byte-reproducibility (design-doc requirement): hashing an isomorphic,
 * re-serialized copy of a record yields the IDENTICAL output — URN and
 * canonical bytes. Also pins doc golden vector 6: cdef:ref vs a fresh
 * unbound SOMETHING hash differently (the coreference IS meaning).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mint, parseRdf, type Quad } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

const load = (rel: string): string => readFileSync(join(fixtures, rel), 'utf8');

/** Rename every blank node and shuffle quad order — an isomorphic copy. */
function isomorphicCopy(quads: Quad[], seed: number): Quad[] {
  const rename = (t: Quad['subject']): Quad['subject'] =>
    t.termType === 'BlankNode' ? { termType: 'BlankNode', value: `renamed_${seed}_${t.value}` } : t;
  const copy = quads.map((q) => ({
    subject: rename(q.subject),
    predicate: q.predicate,
    object: rename(q.object),
    graph: q.graph,
  }));
  // deterministic shuffle
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483647;
    const j = s % (i + 1);
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

describe('byte-reproducibility from an isomorphic re-serialized copy', () => {
  it('hash(bookmark) twice — once from Turtle, once from a bnode-renamed shuffled copy — is identical', async () => {
    const deps = ['bookmarks/xsd-boolean.ttl', 'bookmarks/xsd-string.ttl'].map((f, i) => ({
      name: ['xsd-boolean', 'xsd-string'][i] ?? '',
      quads: parseRdf(load(f)),
    }));
    const original = parseRdf(load('bookmarks/bookmark.ttl'));
    const first = await mint([...deps, { name: 'bookmark', quads: original }]);
    const a = first.records.get('bookmark');

    // re-serialize: parse the ORIGINAL turtle again (fresh bnode labels),
    // rename bnodes + shuffle order — an isomorphic dataset, different bytes in
    const copy = isomorphicCopy(parseRdf(load('bookmarks/bookmark.ttl')), 42);
    const second = await mint([...deps, { name: 'bookmark', quads: copy }]);
    const b = second.records.get('bookmark');

    expect(a?.urn).toBeDefined();
    expect(b?.urn).toBe(a?.urn);
    expect(b?.canonicalNQuads).toBe(a?.canonicalNQuads);
  });

  it('the cyclic component reproduces byte-identically from an isomorphic copy', async () => {
    const alphaQuads = parseRdf(load('cycle/cycle-alpha.ttl'));
    const betaQuads = parseRdf(load('cycle/cycle-beta.ttl'));
    const first = await mint([
      { name: 'cycle-alpha', quads: alphaQuads },
      { name: 'cycle-beta', quads: betaQuads },
    ]);
    const second = await mint([
      { name: 'cycle-beta', quads: isomorphicCopy(parseRdf(load('cycle/cycle-beta.ttl')), 7) },
      { name: 'cycle-alpha', quads: isomorphicCopy(parseRdf(load('cycle/cycle-alpha.ttl')), 9) },
    ]);
    const a1 = first.records.get('cycle-alpha');
    const a2 = second.records.get('cycle-alpha');
    expect(a2?.urn).toBe(a1?.urn);
    expect(a2?.component?.urn).toBe(a1?.component?.urn);
    expect(a2?.component?.index).toBe(a1?.component?.index);
    expect(a2?.canonicalNQuads).toBe(a1?.canonicalNQuads);
  });

  it('minting is deterministic across process-level repetition (same URNs twice)', async () => {
    const r1 = await mint([]);
    const r2 = await mint([]);
    expect([...r1.aliases.entries()]).toEqual([...r2.aliases.entries()]);
  });
});

describe('doc golden vector 6 — cdef:ref vs fresh SOMETHING hash differently', () => {
  const record = (secondSee: string): string => `
@prefix cdef: <urn:concept-def:1#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix p:    <urn:x-mint:prime:> .
<urn:x-mint:v6> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:referents ( [ cdef:refIndex "1"^^xsd:nonNegativeInteger ; cdef:refKind cdef:SomethingRef ] ) ;
    cdef:clauses (
      [ cdef:pred p:SEE ;
        cdef:slot [ cdef:role cdef:experiencer ; cdef:filler [ cdef:head p:SOMEONE ] ] ;
        cdef:slot [ cdef:role cdef:stimulus ;
                    cdef:filler [ cdef:ref "1"^^xsd:nonNegativeInteger ] ] ]
      [ cdef:pred p:SEE ;
        cdef:slot [ cdef:role cdef:experiencer ; cdef:filler [ cdef:head p:PEOPLE ] ] ;
        cdef:slot [ cdef:role cdef:stimulus ; cdef:filler ${secondSee} ] ]
    ) ] .
`;

  it('"sees THE SAME thing" (ref) and "sees SOME thing" (fresh SP) mint different URNs', async () => {
    const withRef = await mint([
      { name: 'v6', quads: parseRdf(record('[ cdef:ref "1"^^xsd:nonNegativeInteger ]')) },
    ]);
    const withFresh = await mint([
      { name: 'v6', quads: parseRdf(record('[ cdef:head <urn:x-mint:prime:SOMETHING~THING> ]')) },
    ]);
    const a = withRef.records.get('v6');
    const b = withFresh.records.get('v6');
    expect(a?.urn).toBeDefined();
    expect(b?.urn).toBeDefined();
    expect(a?.urn).not.toBe(b?.urn);
  });
});

describe('unicode-gloss vector — NFC normalization inside the hash boundary', () => {
  // "café" with U+0301 combining acute (NFD) vs precomposed U+00E9 (NFC) in a
  // linked-ref gloss: mint normalizes to NFC, so both author-forms mint the
  // SAME URN; §7 verify would reject the NFD serving bytes.
  const moleculeWith = (gloss: string, ref: string): string => `
@prefix cdef: <urn:concept-def:1#> .
<urn:x-mint:u-mol> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Molecule ;
  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/legacy#Cafe> ] ;
  cdef:groundingNote "one kind of place; people can be inside places of this kind; {${ref}|${gloss}}" .
`;

  it('NFD-authored and NFC-authored glosses mint the identical URN', async () => {
    // stage 1: mint a referent concept so the linked ref is a real, final URN (§3.5 rule 4)
    const stage1 = await mint([
      {
        name: 'place-kind',
        quads: parseRdf(`
@prefix cdef: <urn:concept-def:1#> .
<urn:x-mint:place-kind> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:AxiomsOnly ;
  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/legacy#Place> ] .
`),
      },
    ]);
    const ref = stage1.records.get('place-kind')?.urn;
    if (ref === undefined) throw new Error('stage-1 mint failed');

    const nfc = 'caf\u00e9'; // café, precomposed é
    const nfd = 'cafe\u0301'; // café, e + U+0301 combining acute
    expect(nfc).not.toBe(nfd);
    expect(nfd.normalize('NFC')).toBe(nfc);

    const a = await mint([{ name: 'u-mol', quads: parseRdf(moleculeWith(nfc, ref)) }], {
      registry: stage1.registry,
    });
    const b = await mint([{ name: 'u-mol', quads: parseRdf(moleculeWith(nfd, ref)) }], {
      registry: stage1.registry,
    });
    const ua = a.records.get('u-mol');
    const ub = b.records.get('u-mol');
    expect(ua?.urn).toBeDefined();
    expect(ua?.urn).toBe(ub?.urn);
    expect(ua?.status).toBe('Molecule');
    expect(ua?.moleculeDepth).toBe(1);
    expect(ua?.canonicalNQuads).toContain(nfc.normalize('NFC'));
  });
});
