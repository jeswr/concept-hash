// AUTHORED-BY Claude Fable 5
/**
 * Exhaustive tests on the untrusted-input surface (design doc §5 caps + §6
 * step 1 + §11): attacker-supplied definitions must fail CLOSED — oversized
 * records, deep bnode nesting, RDFC poison graphs (duplicate first-degree
 * hashes), reserved-token forgery, reference-syntax attacks, symmetric SCCs,
 * bnode cycles / DAG sharing, and non-canonical served bytes.
 */

import { describe, expect, it } from 'vitest';
import {
  blankNode,
  defaultGraph,
  ERR,
  MAX_INPUT_BYTES,
  mint,
  namedNode,
  parseRdf,
  type Quad,
  verifyServed,
} from '../../src/index.js';

const P = 'urn:concept-def:1#';
const prefix = `@prefix cdef: <${P}> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n`;

const mintOne = (name: string, ttl: string) => mint([{ name, quads: parseRdf(prefix + ttl) }]);

const axiomsOnly = (name: string, axioms: string): string =>
  `<urn:x-mint:${name}> a cdef:ConceptDefinition ;\n  cdef:semanticStatus cdef:AxiomsOnly ;\n${axioms} .`;

describe('input-size guards', () => {
  it('rejects input documents over the hard byte guard before parsing', () => {
    const big = `# ${'x'.repeat(MAX_INPUT_BYTES)}`;
    expect(() => parseRdf(big)).toThrowError(new RegExp(ERR.CAPS));
  });

  it('rejects a record whose canonical size exceeds 65,536 bytes', async () => {
    // many bridge axioms with long IRIs → structural bnodes stay under 64 but
    // bytes blow past the cap? 64 axioms × ~1000-byte IRIs ≈ 64KB+ canonical.
    const axioms = Array.from(
      { length: 60 },
      (_, i) =>
        `  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/${'a'.repeat(1200)}/${i}> ] ;`,
    ).join('\n');
    await expect(mintOne('big', axiomsOnly('big', axioms))).rejects.toThrowError(
      new RegExp(ERR.CAPS),
    );
  });
});

describe('blank-node discipline (trees, caps, depth)', () => {
  it('rejects a bnode with two parents (DAG sharing — not a tree)', async () => {
    const quads: Quad[] = [];
    const focus = namedNode('urn:x-mint:dag');
    const g = defaultGraph();
    const shared = blankNode('shared');
    const q = (s: Quad['subject'], p: string, o: Quad['object']): void => {
      quads.push({ subject: s, predicate: namedNode(p), object: o, graph: g });
    };
    q(focus, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', namedNode(`${P}ConceptDefinition`));
    q(focus, `${P}semanticStatus`, namedNode(`${P}AxiomsOnly`));
    q(focus, `${P}axiom`, shared);
    q(focus, `${P}axiom`, shared); // second parent edge to the same bnode
    q(shared, `${P}rel`, namedNode(`${P}bridgesTo`));
    q(shared, `${P}target`, namedNode('https://example.org/x'));
    await expect(mint([{ name: 'dag', quads }])).rejects.toThrowError(new RegExp(ERR.SHAPE));
  });

  it('rejects a bnode cycle', async () => {
    const g = defaultGraph();
    const focus = namedNode('urn:x-mint:cyc');
    const a = blankNode('a');
    const b = blankNode('b');
    const quads: Quad[] = [];
    const q = (s: Quad['subject'], p: string, o: Quad['object']): void => {
      quads.push({ subject: s, predicate: namedNode(p), object: o, graph: g });
    };
    q(focus, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', namedNode(`${P}ConceptDefinition`));
    q(focus, `${P}semanticStatus`, namedNode(`${P}AxiomsOnly`));
    q(focus, `${P}axiom`, a);
    q(a, `${P}rel`, namedNode(`${P}restriction`));
    q(a, `${P}target`, b);
    q(b, `${P}onProperty`, a); // cycle back
    await expect(mint([{ name: 'cyc', quads }])).rejects.toThrowError(new RegExp(ERR.SHAPE));
  });

  it('bounds structural nesting depth at 12 (list spines excluded)', async () => {
    // restriction chains: axiom → restriction bnode → allValuesFrom cannot
    // recurse (concept-ref only), so build depth via nested op-clauses.
    const open = Array.from(
      { length: 14 },
      () => '[ cdef:op <urn:x-mint:prime:NOT> ; cdef:scope ',
    ).join('');
    const close = Array.from({ length: 14 }, () => ' ]').join('');
    const deep = `<urn:x-mint:deep> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:clauses ( ${open} [ cdef:pred <urn:x-mint:prime:HAPPEN> ] ${close} ) ] .`;
    await expect(mintOne('deep', deep)).rejects.toThrowError(new RegExp(ERR.CAPS));
  });

  it('bounds structural blank nodes at 64', async () => {
    // 90 axioms → 90 structural bnodes > the 64 structural cap; fail closed.
    const axioms = Array.from(
      { length: 90 },
      (_, i) =>
        `  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/${i}> ] ;`,
    ).join('\n');
    await expect(mintOne('many', axiomsOnly('many', axioms))).rejects.toThrowError(
      new RegExp(ERR.CAPS),
    );
  });

  it('bounds rdf:List length at 64', async () => {
    const items = Array.from({ length: 70 }, () => '"KIND"').join(' ');
    const ttl = `<urn:x-mint:longlist> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Prime ;
  cdef:primeCategory cdef:RelationalSubstantive ;
  cdef:chartEdition "NSM-EN-v20-2022" ;
  cdef:chartIndex "7"^^xsd:nonNegativeInteger ;
  cdef:exponent ( ${items} ) .`;
    await expect(mintOne('longlist', ttl)).rejects.toThrowError(new RegExp(ERR.CAPS));
  });
});

describe('RDFC poison-graph guard — the duplicate-FDH rule (§6 step 1)', () => {
  it('rejects two blank nodes sharing a first-degree hash (identical sibling subtrees)', async () => {
    // two IDENTICAL axiom subtrees — classic HNDQ permutation fuel
    const ttl = axiomsOnly(
      'poison',
      `  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/same> ] ;
  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/same> ] ;`,
    );
    await expect(mintOne('poison', ttl)).rejects.toThrowError(new RegExp(ERR.DUPLICATE_BNODE_FDH));
  });

  it('accepts sibling subtrees that differ (distinct FDHs)', async () => {
    const ttl = axiomsOnly(
      'fine',
      `  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/one> ] ;
  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/two> ] ;`,
    );
    const r = await mintOne('fine', ttl);
    expect(r.records.get('fine')?.urn).toMatch(/^urn:concept:b/);
  });

  it('rejects a poisoned served representation at verify too', async () => {
    const valid = await mintOne(
      'anyv',
      axiomsOnly(
        'anyv',
        '  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/v> ] ;',
      ),
    );
    const validUrn = valid.records.get('anyv')?.urn;
    if (validUrn === undefined) throw new Error('mint failed');
    const served = `_:a <${P}rel> <${P}bridgesTo> .
_:a <${P}target> <https://example.org/same> .
_:b <${P}rel> <${P}bridgesTo> .
_:b <${P}target> <https://example.org/same> .
<${P}self> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${P}ConceptDefinition> .
<${P}self> <${P}axiom> _:a .
<${P}self> <${P}axiom> _:b .
<${P}self> <${P}semanticStatus> <${P}AxiomsOnly> .
`;
    const quads = parseRdf(served, 'application/n-quads');
    await expect(verifyServed(validUrn, quads, {})).rejects.toThrowError(
      new RegExp(ERR.DUPLICATE_BNODE_FDH),
    );
  });
});

describe('reserved-token + reference-syntax attacks (§5)', () => {
  it('rejects #intra forged into authored content', async () => {
    const ttl = axiomsOnly(
      'forge',
      `  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <${P}intra> ] ;`,
    );
    await expect(mintOne('forge', ttl)).rejects.toThrowError(new RegExp(ERR.RESERVED_TOKEN));
  });

  it('rejects #member-0 forged into authored content', async () => {
    const ttl = axiomsOnly(
      'forge2',
      `  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <${P}member-0> ] ;`,
    );
    await expect(mintOne('forge2', ttl)).rejects.toThrowError(new RegExp(ERR.RESERVED_TOKEN));
  });

  it('rejects an unknown IRI minted into the cdef namespace', async () => {
    const ttl = axiomsOnly(
      'forge3',
      `  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <${P}madeUpToken> ] ;`,
    );
    await expect(mintOne('forge3', ttl)).rejects.toThrowError(new RegExp(ERR.RESERVED_TOKEN));
  });

  it('rejects a urn:concept: reference that matches the regex but fails multihash decode', async () => {
    // valid base32 alphabet, wrong multihash structure (declared length ≠ bytes)
    const bad = 'urn:concept:baaaaaaaaaaaaaaaaaaaaaaa';
    const ttl = axiomsOnly(
      'badref',
      `  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <${bad}> ] ;`,
    );
    await expect(mintOne('badref', ttl)).rejects.toThrowError(new RegExp(ERR.REFERENCE_SYNTAX));
  });

  it('rejects an unresolvable symbolic reference (§6 step 2: hard error)', async () => {
    const ttl = axiomsOnly(
      'dangling',
      '  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <urn:x-mint:nowhere> ] ;',
    );
    await expect(mintOne('dangling', ttl)).rejects.toThrowError(
      new RegExp(ERR.UNRESOLVABLE_REFERENCE),
    );
  });

  it('rejects literals in non-whitelisted positions', async () => {
    const ttl = `<urn:x-mint:lit> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:AxiomsOnly ;
  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target "not-a-ref" ] .`;
    await expect(mintOne('lit', ttl)).rejects.toThrowError(/ERR_/);
  });
});

describe('prime-lexicon byte-match (§4.1)', () => {
  const prime = (body: string): string => `<urn:x-mint:fakeprime> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Prime ;
${body} .`;

  it('rejects a permuted exponent order (chart order is normative)', async () => {
    const ttl = prime(`  cdef:primeCategory cdef:Substantive ;
  cdef:chartEdition "NSM-EN-v20-2022" ;
  cdef:chartIndex "4"^^xsd:nonNegativeInteger ;
  cdef:exponent ( "THING" "SOMETHING" )`);
    await expect(mintOne('fakeprime', ttl)).rejects.toThrowError(
      new RegExp(ERR.PRIME_LEXICON_MISMATCH),
    );
  });

  it('rejects a wrong chart edition', async () => {
    const ttl = prime(`  cdef:primeCategory cdef:RelationalSubstantive ;
  cdef:chartEdition "NSM-EN-v19-2021" ;
  cdef:chartIndex "7"^^xsd:nonNegativeInteger ;
  cdef:exponent ( "KIND" )`);
    await expect(mintOne('fakeprime', ttl)).rejects.toThrowError(
      new RegExp(ERR.PRIME_LEXICON_MISMATCH),
    );
  });

  it('rejects an invented 66th prime', async () => {
    const ttl = prime(`  cdef:primeCategory cdef:Logical ;
  cdef:chartEdition "NSM-EN-v20-2022" ;
  cdef:chartIndex "66"^^xsd:nonNegativeInteger ;
  cdef:exponent ( "BLOCKCHAIN" )`);
    await expect(mintOne('fakeprime', ttl)).rejects.toThrowError(
      new RegExp(ERR.PRIME_LEXICON_MISMATCH),
    );
  });
});

describe('grounding-note lexicon (§3.5)', () => {
  const molecule = (note: string): string => `<urn:x-mint:mol> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Molecule ;
  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/m> ] ;
  cdef:groundingNote ${JSON.stringify(note)} .`;

  it('rejects a bare content word (the doc rev-1 example was illegal)', async () => {
    await expect(
      mintOne('mol', molecule('the connected system of pages people can see on computers')),
    ).rejects.toThrowError(new RegExp(ERR.GROUNDING_LEXICON));
  });

  it('rejects a malformed linked ref (brace residue)', async () => {
    await expect(mintOne('mol', molecule('something of one kind {broken'))).rejects.toThrowError(
      new RegExp(ERR.GROUNDING_LEXICON),
    );
  });

  it('rejects a linked ref that is not a final URN', async () => {
    await expect(
      mintOne('mol', molecule('something of one kind; {urn:x-mint:other|thing}')),
    ).rejects.toThrowError(new RegExp(ERR.GROUNDING_LEXICON));
  });

  it('rejects an oversized note (> 1024 bytes NFC)', async () => {
    const note = `${'good '.repeat(210)}kind`;
    await expect(mintOne('mol', molecule(note))).rejects.toThrowError(new RegExp(ERR.CAPS));
  });

  it('accepts the doc §3.5 token classes (primes, allolexes, punctuation, [m])', async () => {
    const r = await mintOne(
      'mol',
      molecule('something of one kind; there are many things of this kind in many places [m]'),
    );
    expect(r.records.get('mol')?.status).toBe('Molecule');
  });
});

describe('symmetric SCCs fail closed (§6 step 7)', () => {
  it('rejects a perfectly symmetric cyclic pair with ERR_SYMMETRIC_SCC', async () => {
    const a = `${prefix}<urn:x-mint:sym-a> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:AxiomsOnly ;
  cdef:axiom [ cdef:rel cdef:disjointWith ; cdef:target <urn:x-mint:sym-b> ] .`;
    const b = `${prefix}<urn:x-mint:sym-b> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:AxiomsOnly ;
  cdef:axiom [ cdef:rel cdef:disjointWith ; cdef:target <urn:x-mint:sym-a> ] .`;
    await expect(
      mint([
        { name: 'sym-a', quads: parseRdf(a) },
        { name: 'sym-b', quads: parseRdf(b) },
      ]),
    ).rejects.toThrowError(new RegExp(ERR.SYMMETRIC_SCC));
  });
});

describe('referent discipline attacks (§4.2)', () => {
  it('rejects a ref to an undeclared referent', async () => {
    const ttl = `<urn:x-mint:badref2> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:clauses ( [ cdef:pred <urn:x-mint:prime:HAPPEN> ;
      cdef:slot [ cdef:role cdef:undergoer ;
                  cdef:filler [ cdef:ref "5"^^xsd:nonNegativeInteger ] ] ] ) ] .`;
    await expect(mintOne('badref2', ttl)).rejects.toThrowError(new RegExp(ERR.GRAMMAR));
  });

  it('rejects sparse referent declarations (must be dense from 1)', async () => {
    const ttl = `<urn:x-mint:sparse> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:referents (
      [ cdef:refIndex "1"^^xsd:nonNegativeInteger ; cdef:refKind cdef:SomethingRef ]
      [ cdef:refIndex "3"^^xsd:nonNegativeInteger ; cdef:refKind cdef:SomeoneRef ] ) ;
    cdef:clauses ( [ cdef:pred <urn:x-mint:prime:HAPPEN> ] ) ] .`;
    await expect(mintOne('sparse', ttl)).rejects.toThrowError(new RegExp(ERR.GRAMMAR));
  });

  it('rejects a non-prime IRI in cdef:pred position', async () => {
    const ttl = `<urn:x-mint:predatt> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:clauses ( [ cdef:pred <urn:x-mint:predatt> ] ) ] .`;
    await expect(mintOne('predatt', ttl)).rejects.toThrowError(new RegExp(ERR.GRAMMAR));
  });

  it('rejects a missing required valency slot (SEE without stimulus)', async () => {
    const ttl = `<urn:x-mint:nostim> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:Explicated ;
  cdef:explication [
    cdef:frame cdef:InstanceSchema ;
    cdef:clauses ( [ cdef:pred <urn:x-mint:prime:SEE> ;
      cdef:slot [ cdef:role cdef:experiencer ; cdef:filler [ cdef:head <urn:x-mint:prime:SOMEONE> ] ] ] ) ] .`;
    await expect(mintOne('nostim', ttl)).rejects.toThrowError(new RegExp(ERR.GRAMMAR));
  });
});

describe('non-canonical served bytes are rejected, never normalized (§7)', () => {
  it('rejects a served literal with a non-canonical integer form', async () => {
    const served = `<${P}self> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${P}ConceptDefinition> .
<${P}self> <${P}semanticStatus> <${P}Prime> .
<${P}self> <${P}primeCategory> <${P}RelationalSubstantive> .
<${P}self> <${P}chartEdition> "NSM-EN-v20-2022" .
<${P}self> <${P}chartIndex> "07"^^<http://www.w3.org/2001/XMLSchema#nonNegativeInteger> .
<${P}self> <${P}exponent> _:l .
_:l <http://www.w3.org/1999/02/22-rdf-syntax-ns#first> "KIND" .
_:l <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest> <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil> .
`;
    const valid = await mintOne(
      'anyv2',
      axiomsOnly(
        'anyv2',
        '  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/v2> ] ;',
      ),
    );
    const validUrn = valid.records.get('anyv2')?.urn;
    if (validUrn === undefined) throw new Error('mint failed');
    const quads = parseRdf(served, 'application/n-quads');
    await expect(verifyServed(validUrn, quads, {})).rejects.toThrowError(
      new RegExp(ERR.NOT_CANONICAL),
    );
  });

  it('rejects served n-quads whose bytes differ from the canonical bytes (reordered lines)', async () => {
    const r = await mintOne(
      'reorder',
      axiomsOnly(
        'reorder',
        '  cdef:axiom [ cdef:rel cdef:bridgesTo ; cdef:target <https://example.org/r> ] ;',
      ),
    );
    const minted = r.records.get('reorder');
    if (minted === undefined) throw new Error('mint failed');
    const lines = minted.canonicalNQuads.trimEnd().split('\n');
    const reordered = `${lines.slice().reverse().join('\n')}\n`;
    expect(reordered).not.toBe(minted.canonicalNQuads);
    const quads = parseRdf(reordered, 'application/n-quads');
    await expect(verifyServed(minted.urn, quads, { servedNQuads: reordered })).rejects.toThrowError(
      new RegExp(ERR.NOT_CANONICAL),
    );
  });
});
