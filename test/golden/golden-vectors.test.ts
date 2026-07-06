// AUTHORED-BY Claude Fable 5
/**
 * GOLDEN VECTORS — the committed, pinned URNs for the design doc's vector
 * list: a simple concept, a cyclic pair (SCC), a restriction-bnode case, a
 * unicode-gloss vector, a molecule-flagged concept, plus the two
 * existence-proof walkthroughs (the NSM-prime sample records of §3.2 and the
 * re-expressed bookmarks-sector concepts of §3.4) hashed end-to-end.
 *
 * Pinned values live in test/fixtures/golden-urns.json. Regenerate with
 *   GOLDEN_UPDATE=1 npx vitest run test/golden
 * — any diff in that file is a HASH-BREAKING change and must be treated as
 * a new profile, not a patch.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type AuthoredRecord,
  type MintResult,
  mint,
  parseRdf,
  standardPrimeMintSet,
  verifyServed,
} from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');
const goldenPath = join(fixtures, 'golden-urns.json');

function loadFixtureDir(...dirs: string[]): AuthoredRecord[] {
  const records: AuthoredRecord[] = [];
  for (const dir of dirs) {
    const full = join(fixtures, dir);
    for (const file of readdirSync(full).sort()) {
      if (!file.endsWith('.ttl')) continue;
      const name = basename(file, '.ttl');
      records.push({ name, quads: parseRdf(readFileSync(join(full, file), 'utf8')) });
    }
  }
  return records;
}

let result: MintResult;

beforeAll(async () => {
  result = await mint(
    loadFixtureDir('bookmarks', 'gufo', 'restriction', 'molecule', 'cycle', 'annotations'),
  );
});

const urnOf = (name: string): string => {
  const r = result.records.get(name) ?? result.aliases.get(name);
  if (r === undefined) throw new Error(`not minted: ${name}`);
  return typeof r === 'string' ? r : r.urn;
};

describe('golden vectors (pinned URNs)', () => {
  it('matches the committed golden-urns.json byte-for-byte', () => {
    const names = [
      // existence proof 0 — NSM prime sample records (§3.2)
      'prime:KIND',
      'prime:SOMETHING~THING',
      "prime:DON'T-WANT",
      'prime:I',
      'prime:LIKE~AS~WAY',
      // existence proof 1 — gufo:Event walked down (§3.3)
      'concrete-individual',
      'endurant',
      'gufo-event',
      // existence proof 2 — the re-expressed bookmarks sector (§3.4): 7 concepts
      'bookmark',
      'archived',
      'title',
      'notes',
      'locator',
      'xsd-boolean',
      'xsd-string',
      // restriction-bnode case
      'titled-bookmark',
      // molecule-flagged concept
      'molecule-web',
      // cyclic pair (SCC) — incl. a self-referencing member (doc vector 9)
      'cycle-alpha',
      'cycle-beta',
    ];
    const actual: Record<string, string> = {};
    for (const n of names) actual[n] = urnOf(n);
    const alpha = result.records.get('cycle-alpha');
    if (alpha?.component !== undefined) {
      actual['component:cycle'] = alpha.component.urn;
    }

    if (process.env.GOLDEN_UPDATE === '1') {
      writeFileSync(goldenPath, `${JSON.stringify(actual, null, 2)}\n`);
    }
    const expected = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<string, string>;
    expect(actual).toEqual(expected);
  });

  it('mints all 65 primes with distinct URNs', () => {
    const urns = new Set<string>();
    for (const [name, urn] of result.aliases) {
      if (name.startsWith('prime:')) urns.add(urn);
    }
    expect(urns.size).toBe(65);
  });

  it('KIND prime record matches §3.2 (chartIndex 7, RelationalSubstantive)', async () => {
    const primes = await mint(standardPrimeMintSet(), { includeStandardPrimes: false });
    const kind = primes.records.get('prime:KIND');
    expect(kind).toBeDefined();
    expect(kind?.status).toBe('Prime');
    expect(kind?.canonicalNQuads).toContain('"7"');
    expect(kind?.canonicalNQuads).toContain('"KIND"');
    expect(kind?.canonicalNQuads).toContain('"NSM-EN-v20-2022"');
    expect(kind?.canonicalNQuads).toContain('RelationalSubstantive');
  });

  it('SOMETHING~THING pins the ordered two-exponent allolex list', async () => {
    const primes = await mint(standardPrimeMintSet(), { includeStandardPrimes: false });
    const st = primes.records.get('prime:SOMETHING~THING');
    expect(st?.canonicalNQuads).toContain('"SOMETHING"');
    expect(st?.canonicalNQuads).toContain('"THING"');
  });

  it('every hash input begins with the in-band profile header (§6 step 5)', () => {
    for (const [, r] of result.records) {
      const text = new TextDecoder().decode(r.hashInput);
      if (r.kind === 'singleton') {
        expect(text.startsWith('urn:concept-def:1\n')).toBe(true);
      } else {
        expect(text.startsWith('urn:concept-def:1#member\n')).toBe(true);
      }
    }
  });

  it('URNs are urn:concept:<base32-multihash> with valid sha2-256 multihash', () => {
    for (const [, r] of result.records) {
      expect(r.urn).toMatch(/^urn:concept:b[a-z2-7]{20,128}$/);
      expect(r.servingUrl).toBe(`https://models.jeswr.org/i/${r.multibase}`);
    }
  });
});

describe('golden: annotation invariance (doc vector 11, §5 extraction)', () => {
  it('a document carrying labels beside the definition mints the IDENTICAL URN', () => {
    expect(urnOf('annotations-beside')).toBe(urnOf('bookmark'));
  });
});

describe('golden: cyclic pair (§6 steps 6–9)', () => {
  it('assigns contiguous member indices from ordering keys and derives member URNs', () => {
    const alpha = result.records.get('cycle-alpha');
    const beta = result.records.get('cycle-beta');
    expect(alpha?.kind).toBe('member');
    expect(beta?.kind).toBe('member');
    expect(alpha?.component?.urn).toBe(beta?.component?.urn);
    expect(new Set([alpha?.component?.index, beta?.component?.index])).toEqual(new Set([0, 1]));
    expect(alpha?.component?.memberUrns).toContain(alpha?.urn);
    expect(alpha?.component?.memberUrns).toContain(beta?.urn);
    expect(alpha?.urn).not.toBe(beta?.urn);
    // both members are served the same component bytes
    expect(alpha?.canonicalNQuads).toBe(beta?.canonicalNQuads);
    expect(alpha?.canonicalNQuads).toContain('urn:concept-def:1#member-0');
    expect(alpha?.canonicalNQuads).toContain('urn:concept-def:1#member-1');
  });

  it('self-references and sibling references rewrite differently (step-6 table, doc vector 9)', () => {
    const alpha = result.records.get('cycle-alpha');
    // cycle-alpha's self-referential subClassOf must appear as #member-i, never #self/#intra
    expect(alpha?.canonicalNQuads).not.toContain('#self');
    expect(alpha?.canonicalNQuads).not.toContain('#intra');
  });
});

describe('golden: verify-by-recompute round-trips (§7)', () => {
  it('every singleton golden record verifies from its canonical bytes', async () => {
    for (const [, r] of result.records) {
      if (r.kind !== 'singleton') continue;
      const quads = parseRdf(r.canonicalNQuads, 'application/n-quads');
      const verdict = await verifyServed(r.urn, quads, { servedNQuads: r.canonicalNQuads });
      expect(verdict.ok).toBe(true);
      expect(verdict.kind).toBe('singleton');
    }
  });

  it('every cyclic member verifies from the component bytes (index recomputed, never conveyed)', async () => {
    const alpha = result.records.get('cycle-alpha');
    if (alpha === undefined || alpha.component === undefined) throw new Error('missing cycle');
    const quads = parseRdf(alpha.canonicalNQuads, 'application/n-quads');
    const verdict = await verifyServed(alpha.urn, quads, { servedNQuads: alpha.canonicalNQuads });
    expect(verdict.kind).toBe('component-member');
    expect(verdict.memberIndex).toBe(alpha.component.index);
    expect(verdict.componentUrn).toBe(alpha.component.urn);
    // the component URN itself also verifies
    const componentVerdict = await verifyServed(alpha.component.urn, quads, {});
    expect(componentVerdict.kind).toBe('component');
  });

  it('rejects a served representation with one extra triple (§5: REJECT, not ignore)', async () => {
    const r = result.records.get('bookmark');
    if (r === undefined) throw new Error('missing');
    const tampered = `${r.canonicalNQuads}<urn:concept-def:1#self> <http://www.w3.org/2000/01/rdf-schema#label> "sneaky" .\n`;
    const quads = parseRdf(tampered, 'application/n-quads');
    await expect(verifyServed(r.urn, quads, { servedNQuads: tampered })).rejects.toThrow(/ERR_/);
  });

  it('rejects a verified record under the WRONG URN', async () => {
    const a = result.records.get('bookmark');
    const b = result.records.get('archived');
    if (a === undefined || b === undefined) throw new Error('missing');
    const quads = parseRdf(a.canonicalNQuads, 'application/n-quads');
    await expect(verifyServed(b.urn, quads, {})).rejects.toThrow(/ERR_VERIFY/);
  });
});
