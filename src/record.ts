// AUTHORED-BY Claude Fable 5
/**
 * Definition-record extraction (§5 of the design doc) and an indexed view
 * of an extracted record used by validation, grammar checking and hashing.
 *
 * Extraction at MINT: from the focus subject, take the triples whose
 * predicate is in the profile vocabulary, plus, recursively, the blank-node
 * trees they reach. All other triples in the input are ignored (a document
 * carrying labels beside the definition mints the identical URN — golden
 * vector 11). At VERIFY the rule is REJECT, not ignore (§5).
 *
 * The bnode-tree discipline (each blank node exactly one parent, no cycles)
 * is enforced here, during the traversal.
 */

import { type Quad, type Term, termEquals } from './quads.js';
import {
  AXIOM,
  CAPS,
  CHART_EDITION,
  CHART_INDEX,
  ConceptHashError,
  ERR,
  EXPLICATION,
  EXPONENT,
  GROUNDING_NOTE,
  PRIME_CATEGORY,
  RDF_FIRST,
  RDF_NIL,
  RDF_REST,
  RDF_TYPE,
  SEMANTIC_STATUS,
} from './vocab.js';

/** Predicates the extractor follows from the focus subject (§5). */
export const FOCUS_PREDICATES: ReadonlySet<string> = new Set([
  RDF_TYPE,
  SEMANTIC_STATUS,
  AXIOM,
  EXPLICATION,
  GROUNDING_NOTE,
  PRIME_CATEGORY,
  CHART_EDITION,
  CHART_INDEX,
  EXPONENT,
]);

export interface ExtractedRecord {
  /** The focus IRI the record was extracted for. */
  focus: string;
  /** The record's quads (subject = focus or a reached blank node). */
  quads: Quad[];
  /** Blank-node labels in the record, in first-reached order. */
  bnodes: string[];
  /** Blank nodes that are rdf:List cells (have rdf:first/rdf:rest). */
  listCells: Set<string>;
  /**
   * Structural nesting depth per §5's metric: list spines excluded — a list
   * item sits at the depth of the node owning the list.
   */
  maxStructuralDepth: number;
}

/**
 * Extract the definition record for `focus` from a parsed quad set.
 *
 * @param quads       parsed input quads (default graph expected)
 * @param focus       the record's focus IRI
 * @param strict      verify-mode: true ⇒ any triple outside the record REJECTS
 */
export function extractRecord(quads: Quad[], focus: string, strict = false): ExtractedRecord {
  const bySubject = new Map<string, Quad[]>();
  for (const q of quads) {
    if (q.graph.termType !== 'DefaultGraph') {
      throw new ConceptHashError(ERR.SHAPE, 'definition record quads must be in the default graph');
    }
    const key = subjectKey(q.subject);
    const list = bySubject.get(key) ?? [];
    list.push(q);
    bySubject.set(key, list);
  }

  const record: Quad[] = [];
  const bnodes: string[] = [];
  const seenBnodes = new Set<string>();
  const listCells = new Set<string>();
  let maxStructuralDepth = 0;

  const focusQuads = (bySubject.get(`I${focus}`) ?? []).filter((q) =>
    FOCUS_PREDICATES.has(q.predicate.value),
  );
  if (focusQuads.length === 0) {
    throw new ConceptHashError(
      ERR.SHAPE,
      `no profile-vocabulary triples found for focus <${focus}>`,
    );
  }

  const visit = (bnode: string, depth: number, viaList: boolean): void => {
    if (seenBnodes.has(bnode)) {
      throw new ConceptHashError(
        ERR.SHAPE,
        `blank node _:${bnode} has more than one parent or participates in a cycle — records are bnode TREES (§5)`,
      );
    }
    seenBnodes.add(bnode);
    bnodes.push(bnode);
    if (bnodes.length > CAPS.maxTotalBnodes) {
      throw new ConceptHashError(
        ERR.CAPS,
        `record exceeds ${CAPS.maxTotalBnodes} total blank nodes (cap, §5)`,
      );
    }
    const own = bySubject.get(`B${bnode}`) ?? [];
    const isListCell = own.some(
      (q) => q.predicate.value === RDF_FIRST || q.predicate.value === RDF_REST,
    );
    if (isListCell) listCells.add(bnode);
    // list-spine cells do not advance the structural-depth metric (§5)
    const childDepth = isListCell || viaList ? depth : depth + 1;
    if (childDepth > CAPS.maxNestingDepth) {
      throw new ConceptHashError(
        ERR.CAPS,
        `record exceeds structural nesting depth ${CAPS.maxNestingDepth} (cap, §5)`,
      );
    }
    maxStructuralDepth = Math.max(maxStructuralDepth, childDepth);
    for (const q of own) {
      record.push(q);
      if (q.object.termType === 'BlankNode') {
        visit(q.object.value, childDepth, isListCell && q.predicate.value === RDF_REST);
      }
    }
  };

  for (const q of focusQuads) {
    record.push(q);
    if (q.object.termType === 'BlankNode') {
      visit(q.object.value, 0, false);
    }
  }

  if (strict) {
    // Verify-mode: the served representation must contain exactly the record.
    if (quads.length !== record.length) {
      throw new ConceptHashError(
        ERR.VERIFY,
        `served representation contains ${quads.length - record.length} triple(s) outside the definition record (§5 verify rule: REJECT, not ignore)`,
      );
    }
  }

  return { focus, quads: record, bnodes, listCells, maxStructuralDepth };
}

function subjectKey(t: Term): string {
  return t.termType === 'BlankNode' ? `B${t.value}` : `I${t.value}`;
}

/** Indexed accessor view over an extracted record. */
export class RecordIndex {
  readonly record: ExtractedRecord;
  private readonly bySubject = new Map<string, Quad[]>();

  constructor(record: ExtractedRecord) {
    this.record = record;
    for (const q of record.quads) {
      const key = subjectKey(q.subject);
      const list = this.bySubject.get(key) ?? [];
      list.push(q);
      this.bySubject.set(key, list);
    }
  }

  quadsOf(subject: Term): Quad[] {
    return this.bySubject.get(subjectKey(subject)) ?? [];
  }

  objects(subject: Term, predicate: string): Term[] {
    return this.quadsOf(subject)
      .filter((q) => q.predicate.value === predicate)
      .map((q) => q.object);
  }

  /** Exactly-one accessor: throws ERR_SHAPE when count ≠ 1. */
  one(subject: Term, predicate: string): Term {
    const values = this.objects(subject, predicate);
    if (values.length !== 1) {
      throw new ConceptHashError(
        ERR.SHAPE,
        `expected exactly one <${predicate}> on ${describe(subject)}, found ${values.length}`,
      );
    }
    const value = values[0];
    if (value === undefined) throw new ConceptHashError(ERR.SHAPE, 'unreachable');
    return value;
  }

  /** Zero-or-one accessor: throws ERR_SHAPE when count > 1. */
  optional(subject: Term, predicate: string): Term | undefined {
    const values = this.objects(subject, predicate);
    if (values.length > 1) {
      throw new ConceptHashError(
        ERR.SHAPE,
        `expected at most one <${predicate}> on ${describe(subject)}, found ${values.length}`,
      );
    }
    return values[0];
  }

  /** Read a well-formed rdf:List rooted at `head`, enforcing the list-length cap. */
  readList(head: Term): Term[] {
    const items: Term[] = [];
    let cursor = head;
    while (true) {
      if (cursor.termType === 'NamedNode' && cursor.value === RDF_NIL) return items;
      if (cursor.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `malformed rdf:List cell ${describe(cursor)}`);
      }
      const cell = this.quadsOf(cursor);
      const firsts = cell.filter((q) => q.predicate.value === RDF_FIRST);
      const rests = cell.filter((q) => q.predicate.value === RDF_REST);
      if (firsts.length !== 1 || rests.length !== 1 || cell.length !== 2) {
        throw new ConceptHashError(
          ERR.SHAPE,
          `rdf:List cell _:${cursor.value} must have exactly rdf:first + rdf:rest`,
        );
      }
      const first = firsts[0];
      const rest = rests[0];
      if (first === undefined || rest === undefined) {
        throw new ConceptHashError(ERR.SHAPE, 'unreachable');
      }
      items.push(first.object);
      if (items.length > CAPS.maxListLength) {
        throw new ConceptHashError(
          ERR.CAPS,
          `rdf:List exceeds ${CAPS.maxListLength} items (cap, §5)`,
        );
      }
      cursor = rest.object;
    }
  }

  /** All predicates present on a subject. */
  predicatesOf(subject: Term): Set<string> {
    return new Set(this.quadsOf(subject).map((q) => q.predicate.value));
  }
}

export function describe(t: Term): string {
  switch (t.termType) {
    case 'BlankNode':
      return `_:${t.value}`;
    case 'Literal':
      return JSON.stringify(t.value);
    default:
      return `<${t.value}>`;
  }
}

/** All NamedNode values appearing anywhere in the record's quads. */
export function namedNodesIn(quads: Quad[]): Set<string> {
  const out = new Set<string>();
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object]) {
      if (t.termType === 'NamedNode') out.add(t.value);
    }
  }
  return out;
}

/** Substitute NamedNode occurrences per a mapping (subject/object positions). */
export function substituteIris(quads: Quad[], mapping: ReadonlyMap<string, string>): Quad[] {
  const sub = (t: Term): Term => {
    if (t.termType === 'NamedNode') {
      const to = mapping.get(t.value);
      if (to !== undefined) return { termType: 'NamedNode', value: to };
    }
    return t;
  };
  return quads.map((q) => ({
    subject: sub(q.subject),
    predicate: q.predicate,
    object: sub(q.object),
    graph: q.graph,
  }));
}

export { termEquals };
