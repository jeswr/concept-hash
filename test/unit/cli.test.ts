// AUTHORED-BY Claude Fable 5
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/cli.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

function captureStdout(): { out: string[]; err: string[]; restore: () => void } {
  const out: string[] = [];
  const err: string[] = [];
  const o = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  const e = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    err.push(String(chunk));
    return true;
  });
  return {
    out,
    err,
    restore: () => {
      o.mockRestore();
      e.mockRestore();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('concept-hash CLI', () => {
  const bookmarkSet = [
    join(fixtures, 'bookmarks', 'xsd-boolean.ttl'),
    join(fixtures, 'bookmarks', 'xsd-string.ttl'),
    join(fixtures, 'bookmarks', 'bookmark.ttl'),
    join(fixtures, 'bookmarks', 'archived.ttl'),
  ];

  it('hash emits URNs + serving paths (--json)', async () => {
    const cap = captureStdout();
    const code = await main(['hash', ...bookmarkSet, '--json']);
    cap.restore();
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out.join('')) as Record<
      string,
      { urn: string; servingUrl: string }
    >;
    expect(parsed.archived?.urn).toMatch(/^urn:concept:b/);
    expect(parsed.archived?.servingUrl).toMatch(/^https:\/\/models\.jeswr\.org\/i\/b/);
  });

  it('explain prints the exact canonical hash-input bytes (header first)', async () => {
    const cap = captureStdout();
    const code = await main(['explain', 'bookmark', ...bookmarkSet]);
    cap.restore();
    expect(code).toBe(0);
    const bytes = cap.out.join('');
    expect(bytes.startsWith('urn:concept-def:1\n')).toBe(true);
    expect(bytes).toContain('urn:concept-def:1#self');
  });

  it('verify round-trips a canonical serving file, and fails on tamper', async () => {
    // produce the canonical bytes via the library through the CLI explain path
    const cap1 = captureStdout();
    await main(['hash', ...bookmarkSet, '--json']);
    cap1.restore();
    const urns = JSON.parse(cap1.out.join('')) as Record<string, { urn: string }>;
    const cap2 = captureStdout();
    await main(['explain', 'archived', ...bookmarkSet]);
    cap2.restore();
    const canonical = cap2.out.join('').replace(/^urn:concept-def:1\n/, '');

    const dir = mkdtempSync(join(tmpdir(), 'concept-hash-'));
    const served = join(dir, 'archived.nq');
    writeFileSync(served, canonical);

    const cap3 = captureStdout();
    const okCode = await main(['verify', urns.archived?.urn ?? '', served]);
    cap3.restore();
    expect(okCode).toBe(0);
    expect(cap3.out.join('')).toContain('OK singleton');

    const tampered = join(dir, 'tampered.nq');
    writeFileSync(tampered, canonical.replace('"1"', '"2"'));
    const cap4 = captureStdout();
    const badCode = await main(['verify', urns.archived?.urn ?? '', tampered]);
    cap4.restore();
    expect(badCode).toBe(1);
  });

  it('returns 1 with an ERR_ message on an invalid record', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'concept-hash-'));
    const bad = join(dir, 'bad.ttl');
    writeFileSync(
      bad,
      `@prefix cdef: <urn:concept-def:1#> .
<urn:x-mint:bad> a cdef:ConceptDefinition ;
  cdef:semanticStatus cdef:AxiomsOnly ;
  cdef:axiom [ cdef:rel cdef:subClassOf ; cdef:target <urn:concept-def:1#intra> ] .`,
    );
    const cap = captureStdout();
    const code = await main(['hash', bad]);
    cap.restore();
    expect(code).toBe(1);
    expect(cap.err.join('')).toContain('ERR_RESERVED_TOKEN');
  });
});
