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
/** Predicates the extractor follows from the focus subject (§5). */
export declare const FOCUS_PREDICATES: ReadonlySet<string>;
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
export declare function extractRecord(quads: Quad[], focus: string, strict?: boolean): ExtractedRecord;
/** Indexed accessor view over an extracted record. */
export declare class RecordIndex {
    readonly record: ExtractedRecord;
    private readonly bySubject;
    constructor(record: ExtractedRecord);
    quadsOf(subject: Term): Quad[];
    objects(subject: Term, predicate: string): Term[];
    /** Exactly-one accessor: throws ERR_SHAPE when count ≠ 1. */
    one(subject: Term, predicate: string): Term;
    /** Zero-or-one accessor: throws ERR_SHAPE when count > 1. */
    optional(subject: Term, predicate: string): Term | undefined;
    /** Read a well-formed rdf:List rooted at `head`, enforcing the list-length cap. */
    readList(head: Term): Term[];
    /** All predicates present on a subject. */
    predicatesOf(subject: Term): Set<string>;
}
export declare function describe(t: Term): string;
/** All NamedNode values appearing anywhere in the record's quads. */
export declare function namedNodesIn(quads: Quad[]): Set<string>;
/** Substitute NamedNode occurrences per a mapping (subject/object positions). */
export declare function substituteIris(quads: Quad[], mapping: ReadonlyMap<string, string>): Quad[];
export { termEquals };
