/**
 * The §6 hashing pipeline — steps 0–10 of the design doc, implemented
 * exactly:
 *
 *  0. extract each record (§5)
 *  1. validate (shape/caps/reserved/grammar/prime-lexicon/grounding/dup-FDH)
 *  2. resolve external references via the alias table (no by-name refs ever)
 *  3. normalize literals (NFC, canonical XSD lexical forms, lowercase langtags)
 *  4. dependency graph over the mint set → Tarjan SCCs → reverse topo order
 *  5. singleton SCC: own IRI → #self, RDFC-1.0, hash = H(header ‖ canonical N-Quads)
 *  6. cyclic SCC: per-member ordering keys via the exact rewrite table
 *  7. canonical indices: sort by ordering key; duplicates ⇒ ERR_SYMMETRIC_SCC
 *  8. component record: one dataset, member i in named graph #member-i
 *  9. member hashes: H("urn:concept-def:1#member\n" ‖ X_raw ‖ uvarint(i))
 * 10. emission: multihash sha2-256 → multibase base32 → urn:concept:…
 */
import { type Quad } from './quads.js';
import { ConceptRegistry, type StatusName } from './registry.js';
export interface AuthoredRecord {
    /** Symbolic name; the record's focus IRI is `urn:x-mint:<name>`. */
    name: string;
    /** Parsed input quads (default graph). Extraction ignores non-record triples. */
    quads: Quad[];
}
export interface MintOptions {
    /** Alias table: symbolic name → existing final `urn:concept:` URN (§6 inputs). */
    aliases?: Record<string, string>;
    /** Known-concepts registry; minted concepts are registered into it. */
    registry?: ConceptRegistry;
    /** HTTPS serving host (§7). */
    host?: string;
    /**
     * Pre-mint and register the standard 65-prime set, exposing
     * `prime:<NAME>` aliases (default true — defined-layer grammar checks
     * need prime identity).
     */
    includeStandardPrimes?: boolean;
}
export interface MintedRecord {
    name: string;
    urn: string;
    multibase: string;
    servingUrl: string;
    status: StatusName;
    moleculeDepth: number;
    kind: 'singleton' | 'member';
    /** Canonical N-Quads — the served bytes (profile header NOT included; §7). */
    canonicalNQuads: string;
    /** The exact hash input for this record's own digest. */
    hashInput: Uint8Array;
    /** For SCC members: the component this member belongs to. */
    component?: {
        urn: string;
        multibase: string;
        index: number;
        size: number;
        memberUrns: string[];
    };
}
export interface MintResult {
    /** name → minted record (insertion order = input order). */
    records: Map<string, MintedRecord>;
    registry: ConceptRegistry;
    /** name → URN for everything minted in this call (incl. standard primes when enabled). */
    aliases: Map<string, string>;
}
/** Mint a set of authored records (§6). */
export declare function mint(records: AuthoredRecord[], options?: MintOptions): Promise<MintResult>;
/**
 * Tarjan's strongly-connected-components algorithm (iterative). Emits SCCs
 * in reverse topological order of the condensation (dependencies first).
 */
export declare function tarjanSccs(nodes: string[], edges: (n: string) => string[]): string[][];
