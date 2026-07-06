// AUTHORED-BY Claude Fable 5
import { describe, expect, it } from 'vitest';
import { PRIME_BY_INDEX, PRIME_BY_NAME, PRIMES } from '../../src/primes.js';

describe('the pinned prime lexicon (§4.1, chart v20 2022)', () => {
  it('has exactly 65 primes with dense chart indices 1..65', () => {
    expect(PRIMES.length).toBe(65);
    const indices = PRIMES.map((p) => p.chartIndex).sort((a, b) => a - b);
    expect(indices).toEqual(Array.from({ length: 65 }, (_, i) => i + 1));
  });

  it('KIND is chartIndex 7 (the §3.2 normative example)', () => {
    expect(PRIME_BY_INDEX.get(7)?.name).toBe('KIND');
    expect(PRIME_BY_INDEX.get(7)?.category).toBe('RelationalSubstantive');
  });

  it('allolex sets split on ~ in chart order', () => {
    expect(PRIME_BY_NAME.get('SOMETHING~THING')?.exponents).toEqual(['SOMETHING', 'THING']);
    expect(PRIME_BY_NAME.get('OTHER~ELSE~ANOTHER')?.exponents).toEqual([
      'OTHER',
      'ELSE',
      'ANOTHER',
    ]);
    expect(PRIME_BY_NAME.get("DON'T-WANT")?.exponents).toEqual(["DON'T-WANT"]);
  });

  it('has no duplicate names', () => {
    expect(new Set(PRIMES.map((p) => p.name)).size).toBe(65);
  });
});
