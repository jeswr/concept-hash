/**
 * Profile-1 explication grammar checks that require prime IDENTITY (§4):
 * predicate valency frames, operator arguments/arity, determiner /
 * quantifier / modifier / head word-classes, and the indexed-referent
 * discipline (§4.2). Runs at MINT after reference resolution (§6 step 1's
 * grammar clause; ordering rationale in DEVIATIONS.md D5) — §7 verification
 * is structural-only per the doc.
 *
 * Assumes validate.ts's structural shape checks already passed.
 */
import type { RecordIndex } from './record.js';
import type { ConceptRegistry } from './registry.js';
/**
 * Run the grammar/valency/referent checks over a record's explication (§4).
 * No-op for records without one.
 */
export declare function checkExplicationGrammar(ix: RecordIndex, registry: ConceptRegistry): void;
