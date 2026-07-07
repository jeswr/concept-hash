// AUTHORED-BY Claude Fable 5
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
import { describe } from './record.js';
import { ADJUNCT, ANCHOR, ANTECEDENT, BIND, CAUSE, CLAUSES, CONSEQUENT, ConceptHashError, cdef, DET, DET_PRIMES, EFFECT, ERR, FILLER, FILLER_PRIMES, FRAME, FRAME_RELATIONAL_SCHEMA, HEAD, MOD, MOD_PRIMES, OF, OP, OPERATORS, PRED, QUANT, QUANT_PRIMES, QUOTE_CLAUSES, REF, REF_INDEX, REF_KIND, REFERENTS, RESTRICTED_BY, ROLE, SCOPE, SLOT, SUBSTANTIVE_PRIMES, VALENCY, } from './vocab.js';
function inScope(scope, index) {
    let s = scope;
    while (s !== undefined) {
        if (s.introduced.has(index))
            return true;
        s = s.parent;
    }
    return false;
}
/**
 * Run the grammar/valency/referent checks over a record's explication (§4).
 * No-op for records without one.
 */
export function checkExplicationGrammar(ix, registry) {
    const focus = { termType: 'NamedNode', value: ix.record.focus };
    const explication = ix
        .quadsOf(focus)
        .find((q) => q.predicate.value === cdef('explication'))?.object;
    if (explication === undefined)
        return;
    const frame = ix.one(explication, FRAME);
    const frameImplicit = new Set(frame.value === FRAME_RELATIONAL_SCHEMA ? [1, 2] : [1]);
    const ctx = {
        ix,
        registry,
        declaredKinds: new Map(),
        topLevelBinds: new Map(),
    };
    // Referent declarations: dense from 1, unique (§4.2).
    const referentsHead = ix.optional(explication, REFERENTS);
    if (referentsHead !== undefined) {
        const decls = ix.readList(referentsHead);
        for (const d of decls) {
            const idx = readIndex(ix.one(d, REF_INDEX));
            const kind = ix.one(d, REF_KIND);
            if (ctx.declaredKinds.has(idx)) {
                throw new ConceptHashError(ERR.GRAMMAR, `referent index ${idx} declared twice (§4.2)`);
            }
            ctx.declaredKinds.set(idx, kind.value);
        }
        for (let i = 1; i <= ctx.declaredKinds.size; i++) {
            if (!ctx.declaredKinds.has(i)) {
                throw new ConceptHashError(ERR.GRAMMAR, `referent indices must be dense from 1 — missing ${i} (§4.2)`);
            }
        }
    }
    const topScope = { introduced: new Set(frameImplicit) };
    const clauses = ix.readList(ix.one(explication, CLAUSES));
    walkClauseList(ctx, clauses, topScope, false);
    // Every declared, non-frame-implicit referent needs exactly one introducing bind (§4.2).
    for (const [idx] of ctx.declaredKinds) {
        if (frameImplicit.has(idx))
            continue;
        const binds = ctx.topLevelBinds.get(idx) ?? 0;
        if (binds !== 1) {
            throw new ConceptHashError(ERR.GRAMMAR, `declared referent ${idx} must have exactly one introducing cdef:bind occurrence, found ${binds} (§4.2)`);
        }
    }
}
function readIndex(t) {
    if (t.termType !== 'Literal') {
        throw new ConceptHashError(ERR.GRAMMAR, `expected an index literal, got ${describe(t)}`);
    }
    const n = Number(t.value);
    if (!Number.isInteger(n) || n < 1) {
        throw new ConceptHashError(ERR.GRAMMAR, `referent indices are positive integers, got ${t.value}`);
    }
    return n;
}
/**
 * Walk a clause list in order. Introduction-before-use is enforced at clause
 * granularity (DEVIATIONS.md D4): a clause's binds are collected before its
 * refs are checked, and later clauses see earlier clauses' binds.
 */
function walkClauseList(ctx, clauses, scope, insideQuote) {
    for (const clause of clauses) {
        const binds = [];
        collectBinds(ctx, clause, binds);
        for (const idx of binds) {
            // frame-implicit indices never take a bind; re-binding an in-scope index is an error
            if (inScope(scope, idx)) {
                throw new ConceptHashError(ERR.GRAMMAR, `referent ${idx} bound while already in scope (§4.2)`);
            }
            if (!insideQuote && !ctx.declaredKinds.has(idx)) {
                throw new ConceptHashError(ERR.GRAMMAR, `top-level bind of undeclared referent ${idx} — only quote-local referents may be bind-introduced without declaration (§4.2)`);
            }
            if (insideQuote && ctx.declaredKinds.has(idx)) {
                throw new ConceptHashError(ERR.GRAMMAR, `quote-local bind reuses declared referent index ${idx} (§4.2)`);
            }
            scope.introduced.add(idx);
            if (!insideQuote) {
                ctx.topLevelBinds.set(idx, (ctx.topLevelBinds.get(idx) ?? 0) + 1);
            }
        }
        checkClause(ctx, clause, scope, 'top');
    }
}
/** Collect every cdef:bind index in a clause subtree, quotes excluded (quote-locals scope to the quote). */
function collectBinds(ctx, node, out) {
    if (node.termType !== 'BlankNode')
        return;
    for (const q of ctx.ix.quadsOf(node)) {
        if (q.predicate.value === BIND) {
            out.push(readIndex(q.object));
        }
        else if (q.predicate.value === QUOTE_CLAUSES) {
            // quote-local binds do not escape the quote
        }
        else if (q.object.termType === 'BlankNode') {
            const preds = ctx.ix.predicatesOf(q.object);
            if (!preds.has(QUOTE_CLAUSES))
                collectBinds(ctx, q.object, out);
        }
    }
}
function primeName(ctx, t) {
    return t.termType === 'NamedNode' ? ctx.registry.primeNameOf(t.value) : undefined;
}
function checkClause(ctx, node, scope, position) {
    const { ix } = ctx;
    const pred = ix.optional(node, PRED);
    if (pred !== undefined) {
        checkPredClause(ctx, node, pred, scope);
        return;
    }
    const op = ix.one(node, OP);
    const name = primeName(ctx, op);
    if (name === undefined || !(name in OPERATORS)) {
        throw new ConceptHashError(ERR.GRAMMAR, `cdef:op ${describe(op)} does not resolve to a prime in the closed operator inventory (§4.5)`);
    }
    const spec = OPERATORS[name];
    if (spec === undefined)
        throw new ConceptHashError(ERR.GRAMMAR, 'unreachable');
    const present = new Set([SCOPE, ANCHOR, ANTECEDENT, CONSEQUENT, CAUSE, EFFECT].filter((p) => ix.optional(node, p) !== undefined));
    for (const p of spec.req) {
        if (!present.has(p)) {
            throw new ConceptHashError(ERR.GRAMMAR, `operator ${name} requires <${p}> (§4.5)`);
        }
    }
    for (const p of present) {
        if (!spec.req.includes(p) && !spec.opt.includes(p)) {
            throw new ConceptHashError(ERR.GRAMMAR, `operator ${name} does not license <${p}> (§4.5)`);
        }
    }
    if ((name === 'AFTER' || name === 'BEFORE') && !present.has(SCOPE) && position !== 'filler') {
        throw new ConceptHashError(ERR.GRAMMAR, `${name} without a scope is only legal as a time-adjunct filler (§4.5)`);
    }
    // argument clauses / anchors
    for (const p of present) {
        const arg = ix.one(node, p);
        if (p === ANCHOR) {
            checkFiller(ctx, arg, scope, { role: 'anchor' });
        }
        else {
            checkClause(ctx, arg, scope, 'top');
        }
    }
}
function checkPredClause(ctx, node, pred, scope) {
    const { ix } = ctx;
    const name = primeName(ctx, pred);
    if (name === undefined || !(name in VALENCY)) {
        throw new ConceptHashError(ERR.GRAMMAR, `cdef:pred ${describe(pred)} does not resolve to a predicate prime (§4.4)`);
    }
    const frame = VALENCY[name];
    if (frame === undefined)
        throw new ConceptHashError(ERR.GRAMMAR, 'unreachable');
    const roles = new Map();
    for (const s of ix.objects(node, SLOT)) {
        const role = ix.one(s, ROLE).value;
        const local = role.startsWith(cdef('')) ? role.slice(cdef('').length) : role;
        if (roles.has(local)) {
            throw new ConceptHashError(ERR.GRAMMAR, `duplicate slot role ${local} on ${name} (§4.4)`);
        }
        roles.set(local, ix.one(s, FILLER));
    }
    for (const r of frame.req) {
        if (!roles.has(r)) {
            throw new ConceptHashError(ERR.GRAMMAR, `${name} requires slot role ${r} (§4.4)`);
        }
    }
    for (const [r] of roles) {
        if (!frame.req.includes(r) && !frame.opt.includes(r)) {
            throw new ConceptHashError(ERR.GRAMMAR, `${name} does not license slot role ${r} (§4.4)`);
        }
    }
    // TRUE: undergoer must be a ClauseRef referent or a quote (§4.4).
    if (name === 'TRUE') {
        const u = roles.get('undergoer');
        if (u !== undefined)
            checkTrueUndergoer(ctx, u);
    }
    // IS-MINE: possessor is I only (first-person-anchored, §4.4).
    if (name === 'IS-MINE') {
        const possessor = roles.get('possessor');
        if (possessor !== undefined && !isPrimeHeaded(ctx, possessor, 'I')) {
            throw new ConceptHashError(ERR.GRAMMAR, 'IS-MINE possessor must be the prime I (§4.4)');
        }
    }
    for (const [local, filler] of roles) {
        checkFiller(ctx, filler, scope, { role: local });
    }
    for (const a of ix.objects(node, ADJUNCT)) {
        checkFiller(ctx, ix.one(a, FILLER), scope, { role: 'adjunct' });
    }
}
function checkTrueUndergoer(ctx, filler) {
    if (filler.termType === 'BlankNode') {
        const preds = ctx.ix.predicatesOf(filler);
        if (preds.has(QUOTE_CLAUSES))
            return;
        const ref = ctx.ix.optional(filler, REF);
        if (ref !== undefined) {
            const idx = readIndex(ref);
            const kind = ctx.declaredKinds.get(idx);
            if (kind === undefined || kind === cdef('ClauseRef'))
                return;
        }
    }
    throw new ConceptHashError(ERR.GRAMMAR, 'TRUE undergoer must be a ClauseRef referent or a quote — no "true-of" predication exists (§4.4)');
}
function isPrimeHeaded(ctx, filler, prime) {
    if (filler.termType === 'NamedNode')
        return primeName(ctx, filler) === prime;
    if (filler.termType !== 'BlankNode')
        return false;
    const head = ctx.ix.optional(filler, HEAD);
    return head !== undefined && primeName(ctx, head) === prime;
}
function checkFiller(ctx, filler, scope, fctx) {
    const { ix } = ctx;
    if (filler.termType === 'NamedNode') {
        const name = primeName(ctx, filler);
        if (name !== undefined && !FILLER_PRIMES.has(name)) {
            throw new ConceptHashError(ERR.GRAMMAR, `prime ${name} is not a licensed direct filler (§4.5 indexicals/durations)`);
        }
        return; // defined-concept refs are legal fillers
    }
    if (filler.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.GRAMMAR, `unexpected filler ${describe(filler)}`);
    }
    const preds = ix.predicatesOf(filler);
    if (preds.has(QUOTE_CLAUSES)) {
        if (fctx.role !== 'quote' && fctx.role !== 'complement' && fctx.role !== 'undergoer') {
            throw new ConceptHashError(ERR.GRAMMAR, `a quote filler is not licensed in role ${fctx.role} (§4.4)`);
        }
        const quoteScope = { introduced: new Set(), parent: scope };
        walkClauseList(ctx, ix.readList(ix.one(filler, QUOTE_CLAUSES)), quoteScope, true);
        return;
    }
    if (preds.has(PRED) || preds.has(OP)) {
        checkClause(ctx, filler, scope, 'filler');
        return;
    }
    checkSubstantivePhrase(ctx, filler, scope);
}
function checkSubstantivePhrase(ctx, node, scope) {
    const { ix } = ctx;
    const ref = ix.optional(node, REF);
    if (ref !== undefined) {
        const idx = readIndex(ref);
        if (!inScope(scope, idx)) {
            throw new ConceptHashError(ERR.GRAMMAR, `cdef:ref ${idx} references an undeclared or not-yet-introduced referent (§4.2)`);
        }
    }
    const det = ix.optional(node, DET);
    if (det !== undefined) {
        const name = primeName(ctx, det);
        if (name === undefined || !DET_PRIMES.has(name)) {
            throw new ConceptHashError(ERR.GRAMMAR, `cdef:det ${describe(det)} is not a determiner prime (§4.3)`);
        }
    }
    const quant = ix.optional(node, QUANT);
    if (quant !== undefined) {
        const name = primeName(ctx, quant);
        if (name === undefined || !QUANT_PRIMES.has(name)) {
            throw new ConceptHashError(ERR.GRAMMAR, `cdef:quant ${describe(quant)} is not a quantifier prime (§4.3)`);
        }
    }
    for (const m of ix.objects(node, MOD)) {
        const name = primeName(ctx, m);
        if (name === undefined || !MOD_PRIMES.has(name)) {
            throw new ConceptHashError(ERR.GRAMMAR, `cdef:mod ${describe(m)} is not a modifier prime (§4.3)`);
        }
    }
    const head = ix.optional(node, HEAD);
    const of = ix.optional(node, OF);
    if (head !== undefined) {
        const name = primeName(ctx, head);
        if (name !== undefined && !SUBSTANTIVE_PRIMES.has(name)) {
            throw new ConceptHashError(ERR.GRAMMAR, `prime ${name} cannot head a substantive phrase (§4.3)`);
        }
        if (of !== undefined) {
            if (name !== 'KIND' && name !== 'PART') {
                throw new ConceptHashError(ERR.GRAMMAR, 'cdef:of is licensed only on KIND/PART-frame heads (§4.3)');
            }
            checkFiller(ctx, of, scope, { role: 'of' });
        }
    }
    else if (of !== undefined) {
        throw new ConceptHashError(ERR.GRAMMAR, 'cdef:of requires a KIND/PART head (§4.3)');
    }
    const restrictedBy = ix.optional(node, RESTRICTED_BY);
    if (restrictedBy !== undefined) {
        checkClause(ctx, restrictedBy, scope, 'filler');
    }
}
