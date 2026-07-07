// AUTHORED-BY Claude Fable 5
/**
 * Structural (closed-shape) validation of an extracted definition record —
 * §6 step 1's shape / caps / reserved-token / literal-whitelist /
 * prime-lexicon checks. Fail-closed throughout.
 *
 * Grammar checks that need prime *identity* (valency, operator arguments,
 * det/quant/mod classes, referent discipline) live in grammar.ts and run at
 * mint after reference resolution; §7 verification runs only this module
 * (shape + caps + reserved tokens), per the doc's verify path.
 */
import { checkGroundingNote } from './grounding.js';
import { CHART_EDITION_PIN, PRIME_BY_INDEX } from './primes.js';
import { describe } from './record.js';
import { isConceptUrn } from './urn.js';
import { ADJUNCT, ADJUNCT_ROLES, ALL_PROFILE_TERMS, ANCHOR, ANTECEDENT, AXIOM, AXIOM_RELATIONS, BIND, CAPS, CAUSE, CDEF, CHART_EDITION, CHART_INDEX, CLAUSES, CONCEPT_DEFINITION, CONSEQUENT, ConceptHashError, cdef, DET, EFFECT, ERR, EXPLICATION, EXPONENT, FILLER, FRAME, FRAMES, GROUNDING_NOTE, HEAD, MINT_SCHEME, MOD, OF, ON_PROPERTY, OP, PRED, PRIME_CATEGORY, PRIME_CATEGORY_TOKENS, PROPERTY_KIND_TOKENS, QUANT, QUOTE_CLAUSES, RDF_TYPE, REF, REF_INDEX, REF_KIND, REF_KINDS, REFERENTS, REL, REL_BRIDGES_TO, REL_PROPERTY_KIND, REL_RESTRICTION, RESTRICTED_BY, RESTRICTION_CARDINALITY_PREDICATES, RESTRICTION_VALUE_PREDICATES, ROLE, SCOPE, SELF, SEMANTIC_STATUS, SEMANTIC_STATUSES, SLOT, SLOT_ROLES, STATUS_AXIOMS_ONLY, STATUS_EXPLICATED, STATUS_MOLECULE, STATUS_PRIME, TARGET, XSD_NON_NEG_INT, XSD_STRING, } from './vocab.js';
/**
 * Validate one extracted record's closed shape. Returns a summary used by
 * dependency-graph construction and grammar checking.
 */
export function validateRecordShape(ix, options = {}) {
    const allowSymbolic = options.allowSymbolicRefs ?? false;
    const focus = { termType: 'NamedNode', value: ix.record.focus };
    const conceptRefs = new Set();
    const groundingRefs = new Set();
    assertReservedTokens(ix.record.quads);
    assertStructuralBnodeCap(ix);
    // --- focus node -------------------------------------------------------------
    const focusPreds = ix.predicatesOf(focus);
    const type = ix.one(focus, RDF_TYPE);
    if (type.termType !== 'NamedNode' || type.value !== CONCEPT_DEFINITION) {
        throw new ConceptHashError(ERR.SHAPE, `focus must be typed cdef:ConceptDefinition, got ${describe(type)}`);
    }
    const status = ix.one(focus, SEMANTIC_STATUS);
    if (status.termType !== 'NamedNode' || !SEMANTIC_STATUSES.has(status.value)) {
        throw new ConceptHashError(ERR.SHAPE, `cdef:semanticStatus must be one of the four status tokens, got ${describe(status)}`);
    }
    const allowedFocus = new Set([RDF_TYPE, SEMANTIC_STATUS]);
    const isPrime = status.value === STATUS_PRIME;
    const isMolecule = status.value === STATUS_MOLECULE;
    const isExplicated = status.value === STATUS_EXPLICATED;
    const isAxiomsOnly = status.value === STATUS_AXIOMS_ONLY;
    if (isPrime) {
        for (const p of [PRIME_CATEGORY, CHART_EDITION, CHART_INDEX, EXPONENT])
            allowedFocus.add(p);
    }
    else {
        allowedFocus.add(AXIOM);
        if (!isAxiomsOnly)
            allowedFocus.add(EXPLICATION);
        if (isMolecule)
            allowedFocus.add(GROUNDING_NOTE);
    }
    for (const p of focusPreds) {
        if (!allowedFocus.has(p)) {
            throw new ConceptHashError(ERR.SHAPE, `predicate <${p}> is not allowed on a ${localName(status.value)} record's focus (closed shape)`);
        }
    }
    // --- per-status requirements --------------------------------------------------
    if (isPrime) {
        validatePrime(ix, focus);
    }
    else {
        const axioms = ix.objects(focus, AXIOM);
        for (const ax of axioms)
            validateAxiom(ix, ax, conceptRefs, allowSymbolic);
        const explication = ix.optional(focus, EXPLICATION);
        if (isExplicated && explication === undefined) {
            throw new ConceptHashError(ERR.SHAPE, 'an Explicated record must carry a cdef:explication');
        }
        if (isAxiomsOnly && axioms.length === 0) {
            throw new ConceptHashError(ERR.SHAPE, 'an AxiomsOnly record must carry at least one cdef:axiom');
        }
        if (isMolecule) {
            const note = ix.one(focus, GROUNDING_NOTE);
            if (note.termType !== 'Literal' || note.datatype !== XSD_STRING || note.language !== '') {
                throw new ConceptHashError(ERR.SHAPE, 'cdef:groundingNote must be a plain xsd:string literal');
            }
            for (const ref of checkGroundingNote(note.value))
                groundingRefs.add(ref);
        }
        if (explication !== undefined) {
            validateExplicationShape(ix, explication, conceptRefs, allowSymbolic);
        }
        return { status: status.value, conceptRefs, groundingRefs, explication };
    }
    return { status: status.value, conceptRefs, groundingRefs, explication: undefined };
}
// --- reserved tokens (§5) --------------------------------------------------------
function assertReservedTokens(quads) {
    for (const q of quads) {
        for (const t of [q.subject, q.predicate, q.object]) {
            if (t.termType !== 'NamedNode')
                continue;
            if (t.value.startsWith('urn:concept-def:')) {
                if (t.value === SELF)
                    continue;
                if (!ALL_PROFILE_TERMS.has(t.value)) {
                    throw new ConceptHashError(ERR.RESERVED_TOKEN, `<${t.value}> — the urn:concept-def: namespace (except #self and the profile vocabulary) is RESERVED in authored content (§5)`);
                }
            }
        }
    }
}
function assertStructuralBnodeCap(ix) {
    const structural = ix.record.bnodes.filter((b) => !ix.record.listCells.has(b)).length;
    if (structural > CAPS.maxStructuralBnodes) {
        throw new ConceptHashError(ERR.CAPS, `record has ${structural} structural blank nodes (cap ${CAPS.maxStructuralBnodes}, §5)`);
    }
}
// --- concept references ------------------------------------------------------------
/**
 * Check a concept-reference position (§5's fully-anchored rule): a final
 * `urn:concept:` URN (decode-validated), `#self`, or — mint-mode only — a
 * symbolic `urn:x-mint:` name.
 */
export function checkConceptRef(t, allowSymbolic, refs) {
    if (t.termType !== 'NamedNode') {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `expected a concept reference, got ${describe(t)}`);
    }
    const v = t.value;
    if (v === SELF)
        return;
    if (v.startsWith('urn:concept-def:')) {
        throw new ConceptHashError(ERR.RESERVED_TOKEN, `<${v}> is a reserved token, not a concept reference`);
    }
    if (v.startsWith(MINT_SCHEME)) {
        if (!allowSymbolic) {
            throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `symbolic reference <${v}> is not legal here`);
        }
        refs.add(v);
        return;
    }
    if (!isConceptUrn(v)) {
        throw new ConceptHashError(ERR.REFERENCE_SYNTAX, `<${v}> is not a valid urn:concept: reference`);
    }
    refs.add(v);
}
// --- primes (§3.1, §4.1) -------------------------------------------------------------
function validatePrime(ix, focus) {
    const category = ix.one(focus, PRIME_CATEGORY);
    const edition = ix.one(focus, CHART_EDITION);
    const index = ix.one(focus, CHART_INDEX);
    const exponentHead = ix.one(focus, EXPONENT);
    if (category.termType !== 'NamedNode' || !PRIME_CATEGORY_TOKENS.has(category.value)) {
        throw new ConceptHashError(ERR.SHAPE, `invalid cdef:primeCategory ${describe(category)}`);
    }
    if (edition.termType !== 'Literal' || edition.datatype !== XSD_STRING) {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:chartEdition must be an xsd:string literal');
    }
    if (index.termType !== 'Literal' || index.datatype !== XSD_NON_NEG_INT) {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:chartIndex must be an xsd:nonNegativeInteger literal');
    }
    const exponents = ix.readList(exponentHead).map((t) => {
        if (t.termType !== 'Literal' || t.datatype !== XSD_STRING || t.language !== '') {
            throw new ConceptHashError(ERR.SHAPE, `exponent list items must be plain xsd:string literals, got ${describe(t)}`);
        }
        return t.value;
    });
    if (exponents.length === 0 || exponents.length > CAPS.maxExponents) {
        throw new ConceptHashError(ERR.CAPS, `prime must have 1..${CAPS.maxExponents} exponents`);
    }
    // Byte-match against the pinned lexicon table (§4.1) — ERR_PRIME_LEXICON_MISMATCH.
    const mismatch = (why) => {
        throw new ConceptHashError(ERR.PRIME_LEXICON_MISMATCH, `prime record does not byte-match the pinned lexicon: ${why}`);
    };
    if (edition.value !== CHART_EDITION_PIN)
        mismatch(`chartEdition ${JSON.stringify(edition.value)} ≠ ${CHART_EDITION_PIN}`);
    const n = Number(index.value);
    const entry = PRIME_BY_INDEX.get(n);
    if (entry === undefined)
        mismatch(`no prime with chartIndex ${index.value}`);
    if (category.value !== cdef(entry.category)) {
        mismatch(`category ${describe(category)} ≠ cdef:${entry.category} for ${entry.name}`);
    }
    if (exponents.length !== entry.exponents.length ||
        exponents.some((x, i) => x !== entry.exponents[i])) {
        mismatch(`exponents [${exponents.join(', ')}] ≠ pinned [${entry.exponents.join(', ')}] for ${entry.name} (order is chart order)`);
    }
}
// --- axioms (§5) -----------------------------------------------------------------------
function validateAxiom(ix, node, refs, allowSymbolic) {
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `cdef:axiom must point at a blank node, got ${describe(node)}`);
    }
    assertClosed(ix, node, new Set([REL, TARGET]), 'axiom');
    const rel = ix.one(node, REL);
    const target = ix.one(node, TARGET);
    if (rel.termType !== 'NamedNode' || !AXIOM_RELATIONS.has(rel.value)) {
        throw new ConceptHashError(ERR.SHAPE, `cdef:rel must be one of the closed axiom relations, got ${describe(rel)}`);
    }
    if (rel.value === REL_PROPERTY_KIND) {
        if (target.termType !== 'NamedNode' || !PROPERTY_KIND_TOKENS.has(target.value)) {
            throw new ConceptHashError(ERR.SHAPE, `cdef:propertyKind must target cdef:DatatypeProperty or cdef:ObjectProperty`);
        }
        return;
    }
    if (rel.value === REL_BRIDGES_TO) {
        // the one sanctioned external-IRI axiom (§5/§7): an absolute http(s) IRI
        if (target.termType !== 'NamedNode' || !/^https?:\/\/[^\s<>"{}|\\^`]+$/.test(target.value)) {
            throw new ConceptHashError(ERR.SHAPE, `cdef:bridgesTo must target an absolute http(s) IRI, got ${describe(target)}`);
        }
        return;
    }
    if (rel.value === REL_RESTRICTION) {
        validateRestriction(ix, target, refs, allowSymbolic);
        return;
    }
    checkConceptRef(target, allowSymbolic, refs);
}
/** Restriction node shape — a doc-gap completion (DEVIATIONS.md D1). */
function validateRestriction(ix, node, refs, allowSymbolic) {
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `a restriction target must be a blank node, got ${describe(node)}`);
    }
    const allowed = new Set([
        ON_PROPERTY,
        ...RESTRICTION_CARDINALITY_PREDICATES,
        ...RESTRICTION_VALUE_PREDICATES,
    ]);
    assertClosed(ix, node, allowed, 'restriction');
    checkConceptRef(ix.one(node, ON_PROPERTY), allowSymbolic, refs);
    let constraints = 0;
    for (const p of RESTRICTION_CARDINALITY_PREDICATES) {
        const v = ix.optional(node, p);
        if (v === undefined)
            continue;
        constraints += 1;
        if (v.termType !== 'Literal' || v.datatype !== XSD_NON_NEG_INT) {
            throw new ConceptHashError(ERR.SHAPE, `restriction cardinality <${p}> must be xsd:nonNegativeInteger`);
        }
    }
    let values = 0;
    for (const p of RESTRICTION_VALUE_PREDICATES) {
        const v = ix.optional(node, p);
        if (v === undefined)
            continue;
        values += 1;
        checkConceptRef(v, allowSymbolic, refs);
    }
    if (values > 1) {
        throw new ConceptHashError(ERR.SHAPE, 'a restriction may carry at most one of allValuesFrom/someValuesFrom');
    }
    if (constraints === 0 && values === 0) {
        throw new ConceptHashError(ERR.SHAPE, 'a restriction must carry at least one cardinality or value constraint');
    }
}
function validateExplicationShape(ix, node, refs, allowSymbolic) {
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:explication must point at a blank node');
    }
    assertClosed(ix, node, new Set([FRAME, REFERENTS, CLAUSES]), 'explication');
    const frame = ix.one(node, FRAME);
    if (frame.termType !== 'NamedNode' || !FRAMES.has(frame.value)) {
        throw new ConceptHashError(ERR.SHAPE, `cdef:frame must be one of the three typed frames, got ${describe(frame)}`);
    }
    const referentsHead = ix.optional(node, REFERENTS);
    if (referentsHead !== undefined) {
        const decls = ix.readList(referentsHead);
        if (decls.length > CAPS.maxReferents) {
            throw new ConceptHashError(ERR.CAPS, `explication exceeds ${CAPS.maxReferents} referents (cap, §5)`);
        }
        for (const d of decls)
            validateReferentDecl(ix, d);
    }
    const counters = { clauses: 0 };
    const clauses = ix.readList(ix.one(node, CLAUSES));
    if (clauses.length === 0) {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:clauses must be a non-empty list');
    }
    for (const c of clauses)
        validateClause(ix, c, refs, allowSymbolic, counters);
}
function validateReferentDecl(ix, node) {
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, 'a referent declaration must be a blank node');
    }
    assertClosed(ix, node, new Set([REF_INDEX, REF_KIND]), 'referent declaration');
    const idx = ix.one(node, REF_INDEX);
    if (idx.termType !== 'Literal' || idx.datatype !== XSD_NON_NEG_INT) {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:refIndex must be xsd:nonNegativeInteger');
    }
    const kind = ix.one(node, REF_KIND);
    if (kind.termType !== 'NamedNode' || !REF_KINDS.has(kind.value)) {
        throw new ConceptHashError(ERR.SHAPE, `cdef:refKind must be one of the five referent kinds, got ${describe(kind)}`);
    }
}
const CLAUSE_OP_ARG_PREDICATES = new Set([SCOPE, ANCHOR, ANTECEDENT, CONSEQUENT, CAUSE, EFFECT]);
function isClauseNode(ix, node) {
    if (node.termType !== 'BlankNode')
        return false;
    const preds = ix.predicatesOf(node);
    return preds.has(PRED) || preds.has(OP);
}
function validateClause(ix, node, refs, allowSymbolic, counters) {
    counters.clauses += 1;
    if (counters.clauses > CAPS.maxClauses) {
        throw new ConceptHashError(ERR.CAPS, `explication exceeds ${CAPS.maxClauses} clauses incl. quote clauses (cap, §5)`);
    }
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `a clause must be a blank node, got ${describe(node)}`);
    }
    const preds = ix.predicatesOf(node);
    const hasPred = preds.has(PRED);
    const hasOp = preds.has(OP);
    if (hasPred === hasOp) {
        throw new ConceptHashError(ERR.SHAPE, 'a clause carries exactly one of cdef:pred / cdef:op');
    }
    if (hasPred) {
        assertClosed(ix, node, new Set([PRED, SLOT, ADJUNCT]), 'pred-clause');
        checkConceptRef(ix.one(node, PRED), allowSymbolic, refs);
        for (const s of ix.objects(node, SLOT))
            validateSlot(ix, s, SLOT_ROLES, refs, allowSymbolic, counters);
        for (const a of ix.objects(node, ADJUNCT))
            validateSlot(ix, a, ADJUNCT_ROLES, refs, allowSymbolic, counters);
        return;
    }
    assertClosed(ix, node, new Set([OP, ...CLAUSE_OP_ARG_PREDICATES]), 'op-clause');
    checkConceptRef(ix.one(node, OP), allowSymbolic, refs);
    let args = 0;
    for (const p of CLAUSE_OP_ARG_PREDICATES) {
        const v = ix.optional(node, p);
        if (v === undefined)
            continue;
        args += 1;
        // anchor may be a time SP / ref / indexical prime; the rest are clauses
        if (p === ANCHOR) {
            validateFiller(ix, v, refs, allowSymbolic, counters);
        }
        else {
            validateClause(ix, v, refs, allowSymbolic, counters);
        }
    }
    if (args === 0) {
        throw new ConceptHashError(ERR.SHAPE, 'an op-clause must carry at least one argument');
    }
}
function validateSlot(ix, node, roleSet, refs, allowSymbolic, counters) {
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `a slot/adjunct must be a blank node, got ${describe(node)}`);
    }
    assertClosed(ix, node, new Set([ROLE, FILLER]), 'slot');
    const role = ix.one(node, ROLE);
    if (role.termType !== 'NamedNode' || !roleSet.has(role.value)) {
        throw new ConceptHashError(ERR.SHAPE, `role ${describe(role)} is not in the closed role inventory (§4.4)`);
    }
    validateFiller(ix, ix.one(node, FILLER), refs, allowSymbolic, counters);
}
function validateFiller(ix, node, refs, allowSymbolic, counters) {
    if (node.termType === 'NamedNode') {
        // a direct prime / defined-concept reference (e.g. `cdef:filler p:BEFORE`)
        checkConceptRef(node, allowSymbolic, refs);
        return;
    }
    if (node.termType !== 'BlankNode') {
        throw new ConceptHashError(ERR.SHAPE, `a filler must be an IRI or blank node, got ${describe(node)}`);
    }
    const preds = ix.predicatesOf(node);
    if (preds.has(QUOTE_CLAUSES)) {
        assertClosed(ix, node, new Set([QUOTE_CLAUSES]), 'quote');
        const clauses = ix.readList(ix.one(node, QUOTE_CLAUSES));
        if (clauses.length === 0) {
            throw new ConceptHashError(ERR.SHAPE, 'cdef:quoteClauses must be a non-empty list');
        }
        for (const c of clauses)
            validateClause(ix, c, refs, allowSymbolic, counters);
        return;
    }
    if (isClauseNode(ix, node)) {
        validateClause(ix, node, refs, allowSymbolic, counters);
        return;
    }
    validateSubstantivePhrase(ix, node, refs, allowSymbolic, counters);
}
/** SP := [det]? [quant]? [mod]* head [restrictedBy: clause]? — §4.3. */
function validateSubstantivePhrase(ix, node, refs, allowSymbolic, counters) {
    const allowed = new Set([DET, QUANT, MOD, HEAD, OF, REF, BIND, RESTRICTED_BY]);
    assertClosed(ix, node, allowed, 'substantive phrase');
    const preds = ix.predicatesOf(node);
    const ref = ix.optional(node, REF);
    const head = ix.optional(node, HEAD);
    if (ref !== undefined) {
        if (ref.termType !== 'Literal' || ref.datatype !== XSD_NON_NEG_INT) {
            throw new ConceptHashError(ERR.SHAPE, 'cdef:ref must be xsd:nonNegativeInteger');
        }
        if (head !== undefined) {
            throw new ConceptHashError(ERR.SHAPE, 'an SP carries cdef:ref or cdef:head, not both');
        }
    }
    else if (head === undefined) {
        throw new ConceptHashError(ERR.SHAPE, 'an SP must carry cdef:head or cdef:ref');
    }
    if (head !== undefined) {
        checkConceptRef(head, allowSymbolic, refs);
    }
    const of = ix.optional(node, OF);
    if (of !== undefined) {
        // KIND/PART-frame complement: an SP or a concept ref
        validateFiller(ix, of, refs, allowSymbolic, counters);
    }
    const det = ix.optional(node, DET);
    if (det !== undefined)
        checkConceptRef(det, allowSymbolic, refs);
    const quant = ix.optional(node, QUANT);
    if (quant !== undefined)
        checkConceptRef(quant, allowSymbolic, refs);
    for (const m of ix.objects(node, MOD))
        checkConceptRef(m, allowSymbolic, refs);
    const bind = ix.optional(node, BIND);
    if (bind !== undefined && (bind.termType !== 'Literal' || bind.datatype !== XSD_NON_NEG_INT)) {
        throw new ConceptHashError(ERR.SHAPE, 'cdef:bind must be xsd:nonNegativeInteger');
    }
    const restrictedBy = ix.optional(node, RESTRICTED_BY);
    if (restrictedBy !== undefined) {
        validateClause(ix, restrictedBy, refs, allowSymbolic, counters);
    }
    if (preds.size === 0) {
        throw new ConceptHashError(ERR.SHAPE, 'an empty SP node is not a phrase');
    }
}
// --- helpers ------------------------------------------------------------------------------
function assertClosed(ix, node, allowed, kind) {
    for (const p of ix.predicatesOf(node)) {
        if (!allowed.has(p)) {
            throw new ConceptHashError(ERR.SHAPE, `predicate <${p}> is not allowed on a ${kind} node (closed shape)`);
        }
    }
}
function localName(iri) {
    return iri.startsWith(CDEF) ? iri.slice(CDEF.length) : iri;
}
/**
 * Whitelist check over every literal in the record (§5): literals occur only
 * in chartIndex/chartEdition/exponent, groundingNote, refIndex/ref/bind and
 * restriction-cardinality positions. Everything else is ERR_SHAPE.
 */
const LITERAL_PREDICATES = new Set([
    CHART_INDEX,
    CHART_EDITION,
    GROUNDING_NOTE,
    REF_INDEX,
    REF,
    BIND,
    ...RESTRICTION_CARDINALITY_PREDICATES,
]);
export function assertLiteralWhitelist(quads) {
    const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
    for (const q of quads) {
        if (q.object.termType !== 'Literal')
            continue;
        // rdf:first carries exponent-list strings; all other literal positions are direct
        if (q.predicate.value === RDF_FIRST)
            continue;
        if (!LITERAL_PREDICATES.has(q.predicate.value)) {
            throw new ConceptHashError(ERR.SHAPE, `literal ${describe(q.object)} in non-whitelisted position <${q.predicate.value}> (§5 literal whitelist)`);
        }
    }
}
