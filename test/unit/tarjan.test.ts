// AUTHORED-BY Claude Fable 5
import { describe, expect, it } from 'vitest';
import { tarjanSccs } from '../../src/mint.js';

describe('Tarjan SCCs (§6 step 4)', () => {
  it('emits dependencies before dependents (reverse topological order)', () => {
    const edges: Record<string, string[]> = { a: ['b'], b: ['c'], c: [] };
    const sccs = tarjanSccs(['a', 'b', 'c'], (n) => edges[n] ?? []);
    expect(sccs.map((s) => s.join(','))).toEqual(['c', 'b', 'a']);
  });

  it('groups a cycle into one component', () => {
    const edges: Record<string, string[]> = { a: ['b'], b: ['a'], c: ['a'] };
    const sccs = tarjanSccs(['a', 'b', 'c'], (n) => edges[n] ?? []);
    expect(sccs.length).toBe(2);
    expect(new Set(sccs[0])).toEqual(new Set(['a', 'b']));
    expect(sccs[1]).toEqual(['c']);
  });

  it('treats a self-loop as a singleton (§6 step 5 handles self-references)', () => {
    const edges: Record<string, string[]> = { a: ['a'] };
    const sccs = tarjanSccs(['a'], (n) => edges[n] ?? []);
    expect(sccs).toEqual([['a']]);
  });

  it('handles a 3-cycle with a tail', () => {
    const edges: Record<string, string[]> = { a: ['b'], b: ['c'], c: ['a'], d: ['a'] };
    const sccs = tarjanSccs(['d', 'a', 'b', 'c'], (n) => edges[n] ?? []);
    expect(sccs.length).toBe(2);
    expect(new Set(sccs[0])).toEqual(new Set(['a', 'b', 'c']));
    expect(sccs[1]).toEqual(['d']);
  });
});
