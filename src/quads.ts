// AUTHORED-BY Claude Fable 5
/**
 * Quad model + literal normalization (§6 step 3) + RDFC-1.0 wrapper +
 * first-degree-hash computation (§6 step 1's duplicate-FDH rule).
 *
 * RDF parsing is done by N3.js; canonicalization by rdf-canonize (the
 * audited digitalbazaar RDFC-1.0 implementation). Nothing here hand-parses
 * RDF syntax; per-quad N-Quads serialization for FDHs reuses rdf-canonize's
 * own `NQuads.serializeQuad` so FDH bytes match the canonicalizer's.
 */

import { createHash } from 'node:crypto';
import type * as RDF from '@rdfjs/types';
import rdfCanonize, { type CanonizeQuad, type CanonizeTerm } from 'rdf-canonize';
import { ConceptHashError, ERR, XSD_NS, XSD_STRING } from './vocab.js';

const { canonize, NQuads } = rdfCanonize;

export type Term =
  | { termType: 'NamedNode'; value: string }
  | { termType: 'BlankNode'; value: string }
  | { termType: 'Literal'; value: string; datatype: string; language: string }
  | { termType: 'DefaultGraph'; value: '' };

export interface Quad {
  subject: Term;
  predicate: Term;
  object: Term;
  graph: Term;
}

export const namedNode = (value: string): Term => ({ termType: 'NamedNode', value });
export const blankNode = (value: string): Term => ({ termType: 'BlankNode', value });
export const literal = (value: string, datatype = XSD_STRING, language = ''): Term => ({
  termType: 'Literal',
  value,
  datatype,
  language,
});
export const defaultGraph = (): Term => ({ termType: 'DefaultGraph', value: '' });

export function termEquals(a: Term, b: Term): boolean {
  if (a.termType !== b.termType || a.value !== b.value) return false;
  if (a.termType === 'Literal' && b.termType === 'Literal') {
    return a.datatype === b.datatype && a.language === b.language;
  }
  return true;
}

/** Convert an RDF/JS quad (e.g. from N3) to the plain model. */
export function fromRdfjs(q: RDF.Quad): Quad {
  return {
    subject: fromRdfjsTerm(q.subject),
    predicate: fromRdfjsTerm(q.predicate),
    object: fromRdfjsTerm(q.object),
    graph: fromRdfjsTerm(q.graph),
  };
}

function fromRdfjsTerm(t: RDF.Term): Term {
  switch (t.termType) {
    case 'NamedNode':
      return namedNode(t.value);
    case 'BlankNode':
      return blankNode(t.value);
    case 'Literal':
      return {
        termType: 'Literal',
        value: t.value,
        datatype: t.datatype.value,
        language: t.language,
      };
    case 'DefaultGraph':
      return defaultGraph();
    default:
      throw new ConceptHashError(ERR.SHAPE, `unsupported term type ${t.termType}`);
  }
}

function toCanonizeTerm(t: Term): CanonizeTerm {
  if (t.termType === 'Literal') {
    const out: CanonizeTerm = {
      termType: 'Literal',
      value: t.value,
      datatype: { termType: 'NamedNode', value: t.datatype },
    };
    if (t.language) out.language = t.language;
    return out;
  }
  return { termType: t.termType, value: t.value };
}

export function toCanonizeQuad(q: Quad): CanonizeQuad {
  return {
    subject: toCanonizeTerm(q.subject),
    predicate: toCanonizeTerm(q.predicate),
    object: toCanonizeTerm(q.object),
    graph: toCanonizeTerm(q.graph),
  };
}

// --- literal normalization (§6 step 3) ----------------------------------------

const XSD_INTEGER = `${XSD_NS}integer`;
const XSD_NON_NEG = `${XSD_NS}nonNegativeInteger`;
const XSD_DECIMAL = `${XSD_NS}decimal`;
const XSD_DOUBLE = `${XSD_NS}double`;
const XSD_BOOLEAN = `${XSD_NS}boolean`;

/**
 * Normalize one literal per §6 step 3: NFC everywhere; canonical XSD 1.1
 * lexical forms for integer/nonNegativeInteger/decimal/double/boolean;
 * language tags lowercased (deliberate BCP47 divergence, stated in the doc).
 * Invalid lexical forms for the whitelisted datatypes fail closed.
 */
export function normalizeLiteral(
  t: Term & { termType: 'Literal' },
): Term & { termType: 'Literal' } {
  let value = t.value.normalize('NFC');
  const datatype = t.datatype;
  const language = t.language.toLowerCase();
  switch (datatype) {
    case XSD_INTEGER:
    case XSD_NON_NEG: {
      if (!/^[+-]?\d+$/.test(value)) {
        throw new ConceptHashError(
          ERR.SHAPE,
          `invalid ${datatype} literal: ${JSON.stringify(value)}`,
        );
      }
      const neg = value.startsWith('-');
      const digits = value.replace(/^[+-]/, '').replace(/^0+(?=\d)/, '');
      if (datatype === XSD_NON_NEG && neg && digits !== '0') {
        throw new ConceptHashError(ERR.SHAPE, `negative nonNegativeInteger: ${value}`);
      }
      value = neg && digits !== '0' ? `-${digits}` : digits;
      break;
    }
    case XSD_DECIMAL: {
      if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value)) {
        throw new ConceptHashError(
          ERR.SHAPE,
          `invalid xsd:decimal literal: ${JSON.stringify(value)}`,
        );
      }
      const neg = value.startsWith('-');
      let [int = '', frac = ''] = value.replace(/^[+-]/, '').split('.');
      int = int.replace(/^0+(?=\d)/, '') || '0';
      frac = frac.replace(/0+$/, '') || '0';
      const canonical = `${int}.${frac}`;
      value = neg && canonical !== '0.0' ? `-${canonical}` : canonical;
      break;
    }
    case XSD_DOUBLE: {
      if (
        !/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value) &&
        !/^(\+|-)?INF$|^NaN$/.test(value)
      ) {
        throw new ConceptHashError(
          ERR.SHAPE,
          `invalid xsd:double literal: ${JSON.stringify(value)}`,
        );
      }
      if (value === 'INF' || value === '+INF' || value === '-INF' || value === 'NaN') break;
      const n = Number(value);
      // XSD 1.1 canonical scientific form: mantissa in [1,10) with at least one
      // fractional digit, canonical exponent (0 allowed, no leading zeros).
      if (n === 0) {
        value = Object.is(n, -0) ? '-0.0E0' : '0.0E0';
      } else {
        const exp = Math.floor(Math.log10(Math.abs(n)));
        let mantissa = n / 10 ** exp;
        // guard rounding drift at the boundary
        let e = exp;
        if (Math.abs(mantissa) >= 10) {
          mantissa /= 10;
          e += 1;
        } else if (Math.abs(mantissa) < 1) {
          mantissa *= 10;
          e -= 1;
        }
        let m = String(mantissa);
        if (!m.includes('.')) m = `${m}.0`;
        value = `${m}E${e}`;
      }
      break;
    }
    case XSD_BOOLEAN: {
      if (value === '1') value = 'true';
      else if (value === '0') value = 'false';
      else if (value !== 'true' && value !== 'false') {
        throw new ConceptHashError(
          ERR.SHAPE,
          `invalid xsd:boolean literal: ${JSON.stringify(value)}`,
        );
      }
      break;
    }
    default:
      break;
  }
  return { termType: 'Literal', value, datatype: datatype.normalize('NFC'), language };
}

/** True iff the literal is already in the normalized form (verify-side check, §7). */
export function isLiteralCanonical(t: Term & { termType: 'Literal' }): boolean {
  const n = normalizeLiteral(t);
  return n.termType === 'Literal' && n.value === t.value && n.language === t.language;
}

function normalizeTerm(t: Term): Term {
  if (t.termType === 'Literal') return normalizeLiteral(t);
  if (t.termType === 'NamedNode') return namedNode(t.value.normalize('NFC'));
  return t;
}

/** Normalize every literal (and NFC every IRI) in a quad set. */
export function normalizeQuads(quads: Quad[]): Quad[] {
  return quads.map((q) => ({
    subject: normalizeTerm(q.subject),
    predicate: normalizeTerm(q.predicate),
    object: normalizeTerm(q.object),
    graph: normalizeTerm(q.graph),
  }));
}

// --- RDFC-1.0 ------------------------------------------------------------------

/**
 * Canonicalize a quad set with RDFC-1.0 (SHA-256 internal digest,
 * rdf-canonize's default fail-closed work factor as the poison-graph
 * backstop). Returns the canonical N-Quads string.
 */
export async function canonicalNQuads(quads: Quad[]): Promise<string> {
  return canonize(quads.map(toCanonizeQuad), {
    algorithm: 'RDFC-1.0',
    messageDigestAlgorithm: 'sha256',
  });
}

// --- first-degree hashes (§6 step 1, duplicate-FDH rule) ------------------------

/**
 * Compute the RDFC-1.0 first-degree hash for every blank node in the quad
 * set (RDFC-1.0 §4.6 Hash First Degree Quads): for blank node b, serialize
 * every quad mentioning b with b as `_:a` and every other blank node as
 * `_:z`, sort, concatenate, SHA-256.
 */
export function firstDegreeHashes(quads: Quad[]): Map<string, string> {
  const byBnode = new Map<string, Quad[]>();
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object, q.graph]) {
      if (t.termType === 'BlankNode') {
        const list = byBnode.get(t.value) ?? [];
        if (!list.includes(q)) list.push(q);
        byBnode.set(t.value, list);
      }
    }
  }
  const out = new Map<string, string>();
  for (const [bnode, mentions] of byBnode) {
    const lines = mentions.map((q) => {
      const sub = (t: Term): Term =>
        t.termType === 'BlankNode' ? blankNode(t.value === bnode ? 'a' : 'z') : t;
      return NQuads.serializeQuad(
        toCanonizeQuad({
          subject: sub(q.subject),
          predicate: sub(q.predicate),
          object: sub(q.object),
          graph: sub(q.graph),
        }),
      );
    });
    lines.sort();
    out.set(bnode, createHash('sha256').update(lines.join(''), 'utf8').digest('hex'));
  }
  return out;
}

/** Refinement rounds: structural depth cap + slack (see DEVIATIONS.md D8). */
const REFINEMENT_ROUNDS = 16;

/**
 * The duplicate-FDH gate rule (§6 step 1), implemented as bounded
 * WL-style color refinement — DEVIATIONS.md D8.
 *
 * The doc's literal rule ("any two blank nodes sharing a first-degree hash
 * ⇒ reject") rejects the doc's OWN §3.3/§3.4 golden records: every
 * `[ cdef:ref "n" ]` coreference-mention node has an identical one-quad
 * subtree, so any record mentioning a referent twice trips it. The rule's
 * *purpose* is to keep hostile records out of RDFC's Hash-N-Degree-Quads
 * permutation search; the class that fuels that search is blank nodes that
 * are locally AUTOMORPHIC — indistinguishable no matter how far you look.
 *
 * So: start from every bnode's RDFC first-degree hash, then refine each
 * color with its neighbours' colors (quad-position-aware) for a bounded
 * number of rounds (or until the partition stabilizes). Bnodes still
 * sharing a color are genuinely automorphic within the bound — e.g.
 * byte-identical sibling subtrees, which ARE redundant assertions — and the
 * record is rejected with the doc's error code. Coreference mentions under
 * distinct parents separate in one or two rounds and are accepted.
 */
export function assertNoDuplicateFdh(quads: Quad[]): void {
  let colors = firstDegreeHashes(quads);
  if (colorsUnique(colors)) return;

  const mentions = new Map<string, Quad[]>();
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object, q.graph]) {
      if (t.termType === 'BlankNode') {
        const list = mentions.get(t.value) ?? [];
        if (!list.includes(q)) list.push(q);
        mentions.set(t.value, list);
      }
    }
  }

  let distinct = new Set(colors.values()).size;
  for (let round = 0; round < REFINEMENT_ROUNDS; round++) {
    const next = new Map<string, string>();
    for (const [bnode, own] of mentions) {
      const lines = (mentions.get(bnode) ?? own).map((q) => {
        const sub = (t: Term): Term => {
          if (t.termType !== 'BlankNode') return t;
          if (t.value === bnode) return blankNode('a');
          return blankNode(`c${colors.get(t.value) ?? 'z'}`);
        };
        return NQuads.serializeQuad(
          toCanonizeQuad({
            subject: sub(q.subject),
            predicate: q.predicate,
            object: sub(q.object),
            graph: sub(q.graph),
          }),
        );
      });
      lines.sort();
      const hash = createHash('sha256');
      hash.update(colors.get(bnode) ?? '', 'utf8');
      hash.update(lines.join(''), 'utf8');
      next.set(bnode, hash.digest('hex'));
    }
    colors = next;
    if (colorsUnique(colors)) return;
    const nextDistinct = new Set(colors.values()).size;
    if (nextDistinct === distinct) break; // partition stabilized — automorphic remainder
    distinct = nextDistinct;
  }

  // find one offending pair for the error message
  const seen = new Map<string, string>();
  for (const [bnode, color] of colors) {
    const prior = seen.get(color);
    if (prior !== undefined) {
      throw new ConceptHashError(
        ERR.DUPLICATE_BNODE_FDH,
        `blank nodes _:${prior} and _:${bnode} are indistinguishable after color refinement (duplicate first-degree hash class; identical sibling subtrees are redundant assertions)`,
      );
    }
    seen.set(color, bnode);
  }
}

function colorsUnique(colors: Map<string, string>): boolean {
  return new Set(colors.values()).size === colors.size;
}
