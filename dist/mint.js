// AUTHORED-BY Claude Fable 5
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
import { createHash } from 'node:crypto';
import { checkExplicationGrammar } from './grammar.js';
import { PRIME_BY_INDEX } from './primes.js';
import { standardPrimeMintSet } from './primeset.js';
import { assertNoDuplicateFdh, canonicalNQuads, normalizeQuads } from './quads.js';
import { extractRecord, namedNodesIn, RecordIndex, substituteIris, } from './record.js';
import { ConceptRegistry } from './registry.js';
import { digestToUrn, urnToMultibase, uvarint } from './urn.js';
import { assertLiteralWhitelist, validateRecordShape } from './validate.js';
import { CAPS, CHART_INDEX, ConceptHashError, DEFAULT_SERVE_HOST, ERR, INTRA, MEMBER_HEADER, MINT_SCHEME, memberIri, PROFILE_HEADER, SELF, STATUS_EXPLICATED, STATUS_MOLECULE, STATUS_PRIME, servingPath, } from './vocab.js';
const sha256 = (data) => new Uint8Array(createHash('sha256').update(data).digest());
const utf8 = (s) => new TextEncoder().encode(s);
function concatBytes(...parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}
/** Mint a set of authored records (§6). */
export async function mint(records, options = {}) {
    const registry = options.registry ?? new ConceptRegistry();
    const host = options.host ?? DEFAULT_SERVE_HOST;
    const aliasOut = new Map();
    const results = new Map();
    const aliases = { ...(options.aliases ?? {}) };
    // Pre-mint the standard prime set (unless we're the recursive call doing so).
    if (options.includeStandardPrimes !== false) {
        const primeResult = await mint(standardPrimeMintSet(), {
            registry,
            host,
            includeStandardPrimes: false,
        });
        for (const [name, urn] of primeResult.aliases) {
            aliases[name] = urn;
            aliasOut.set(name, urn);
        }
    }
    // Duplicate names / focus collisions fail closed.
    const byName = new Map();
    // ---- steps 0–1a: extract + structural validation --------------------------------
    for (const r of records) {
        if (byName.has(r.name)) {
            throw new ConceptHashError(ERR.SHAPE, `duplicate record name in mint set: ${r.name}`);
        }
        const focus = `${MINT_SCHEME}${r.name}`;
        const extracted = extractRecord(r.quads, focus, false);
        assertLiteralWhitelist(extracted.quads);
        const index = new RecordIndex(extracted);
        const summary = validateRecordShape(index, { allowSymbolicRefs: true });
        byName.set(r.name, {
            name: r.name,
            focus,
            extracted,
            index,
            summary,
            externalSubs: new Map(),
            intraDeps: new Set(),
        });
    }
    // ---- step 2: resolve external references ----------------------------------------
    for (const w of byName.values()) {
        for (const ref of w.summary.conceptRefs) {
            if (!ref.startsWith(MINT_SCHEME))
                continue; // already a final URN
            if (ref === w.focus)
                continue; // self-reference — rewritten in steps 5/6
            const symbolic = ref.slice(MINT_SCHEME.length);
            if (byName.has(symbolic)) {
                w.intraDeps.add(ref);
                continue;
            }
            const resolved = aliases[symbolic];
            if (resolved === undefined) {
                throw new ConceptHashError(ERR.UNRESOLVABLE_REFERENCE, `record ${w.name} references <${ref}> which is neither in the mint set nor the alias table (§6 step 2)`);
            }
            urnToMultibase(resolved); // decode-validate the alias target
            w.externalSubs.set(ref, resolved);
        }
        // Grounding-note refs must already be final URNs (§3.5 rule 4) — enforced by
        // grounding.ts; here we enforce never-intra-mint/never-intra-SCC by construction.
    }
    // ---- step 4: dependency graph → Tarjan SCCs → reverse topological order ----------
    const names = [...byName.keys()];
    const sccs = tarjanSccs(names, (name) => {
        const w = byName.get(name);
        if (w === undefined)
            return [];
        return [...w.intraDeps].map((iri) => iri.slice(MINT_SCHEME.length));
    });
    // Tarjan emits SCCs in reverse topological order of the condensation
    // (dependencies before dependents) — exactly the processing order §6 needs.
    for (const scc of sccs) {
        if (scc.length > CAPS.maxSccSize) {
            throw new ConceptHashError(ERR.CAPS, `SCC of size ${scc.length} exceeds ${CAPS.maxSccSize} (cap, §5)`);
        }
        const members = scc.map((n) => byName.get(n)).filter((w) => w !== undefined);
        // Resolve each member's record: externals + already-minted intra-set deps → final URNs;
        // then step 3 literal normalization. Own IRI + same-SCC refs remain for steps 5/6.
        const sccFocuses = new Set(members.map((m) => m.focus));
        const resolved = new Map();
        for (const m of members) {
            const subs = new Map(m.externalSubs);
            for (const dep of m.intraDeps) {
                if (sccFocuses.has(dep))
                    continue; // same-SCC — steps 6/8 rewrite these
                const depName = dep.slice(MINT_SCHEME.length);
                const minted = results.get(depName);
                if (minted === undefined) {
                    throw new ConceptHashError(ERR.UNRESOLVABLE_REFERENCE, `dependency ${depName} not yet minted (internal ordering error)`);
                }
                subs.set(dep, minted.urn);
            }
            const quads = normalizeQuads(substituteIris(m.extracted.quads, subs));
            resolved.set(m.name, quads);
        }
        // ---- step 1b: grammar checks (need resolved prime identity; DEVIATIONS.md D5) ----
        for (const m of members) {
            const quads = resolved.get(m.name);
            if (quads === undefined)
                continue;
            const ix = new RecordIndex({ ...m.extracted, quads });
            checkExplicationGrammar(ix, registry);
        }
        const isCycle = members.length > 1;
        if (!isCycle) {
            const m = members[0];
            if (m === undefined)
                continue;
            const quads = resolved.get(m.name);
            if (quads === undefined)
                continue;
            const minted = await mintSingleton(m, quads, host);
            finishRecord(m, minted, registry, results, aliasOut, sccFocuses);
        }
        else {
            const mintedMembers = await mintComponent(members, resolved, host);
            for (const [m, minted] of mintedMembers) {
                finishRecord(m, minted, registry, results, aliasOut, sccFocuses);
            }
        }
    }
    // Preserve input order in the result map.
    const ordered = new Map();
    for (const r of records) {
        const minted = results.get(r.name);
        if (minted !== undefined)
            ordered.set(r.name, minted);
    }
    return { records: ordered, registry, aliases: aliasOut };
}
// ---- steps 5 + 10: singleton --------------------------------------------------------
async function mintSingleton(w, quads, host) {
    // own IRI → #self everywhere, including self-referential axiom positions
    const rewritten = substituteIris(quads, new Map([[w.focus, SELF]]));
    assertNoDuplicateFdh(rewritten);
    const nquads = await canonicalNQuads(rewritten);
    assertCanonicalSize(nquads, w.name);
    const hashInput = concatBytes(utf8(PROFILE_HEADER), utf8(nquads));
    const urn = digestToUrn(sha256(hashInput));
    const multibase = urnToMultibase(urn);
    return {
        name: w.name,
        urn,
        multibase,
        servingUrl: servingPath(multibase, host),
        kind: 'singleton',
        canonicalNQuads: nquads,
        hashInput,
    };
}
// ---- steps 6–10: cyclic component ----------------------------------------------------
async function mintComponent(members, resolved, host) {
    const sccFocuses = members.map((m) => m.focus);
    // step 6 — ordering keys via the exact rewrite table:
    //   own IRI (subject or any position) → #self; any OTHER member's IRI → #intra
    const keyed = [];
    for (const m of members) {
        const quads = resolved.get(m.name);
        if (quads === undefined)
            throw new ConceptHashError(ERR.SHAPE, 'unreachable');
        const mapping = new Map();
        for (const f of sccFocuses)
            mapping.set(f, f === m.focus ? SELF : INTRA);
        const rewritten = substituteIris(quads, mapping);
        const nquads = await canonicalNQuads(rewritten);
        assertCanonicalSize(nquads, m.name);
        const digest = sha256(concatBytes(utf8(PROFILE_HEADER), utf8(nquads)));
        keyed.push({ m, key: Buffer.from(digest).toString('hex') });
    }
    // step 7 — canonical indices: byte-lexicographic sort; duplicates fail closed
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (let i = 1; i < keyed.length; i++) {
        const prev = keyed[i - 1];
        const cur = keyed[i];
        if (prev !== undefined && cur !== undefined && prev.key === cur.key) {
            throw new ConceptHashError(ERR.SYMMETRIC_SCC, `members ${prev.m.name} and ${cur.m.name} have identical ordering keys — add a distinguishing axiom or merge (§6 step 7)`);
        }
    }
    // step 8 — component record: member i in named graph #member-i, default graph EMPTY
    const indexByFocus = new Map();
    keyed.forEach(({ m }, i) => {
        indexByFocus.set(m.focus, i);
    });
    const datasetQuads = [];
    for (const [i, { m }] of keyed.entries()) {
        const quads = resolved.get(m.name);
        if (quads === undefined)
            continue;
        const mapping = new Map();
        for (const f of sccFocuses) {
            const idx = indexByFocus.get(f);
            if (idx !== undefined)
                mapping.set(f, memberIri(idx));
        }
        const graph = { termType: 'NamedNode', value: memberIri(i) };
        for (const q of substituteIris(quads, mapping)) {
            datasetQuads.push({ ...q, graph });
        }
    }
    // duplicate-FDH rule over the whole component dataset (§6 step 8)
    assertNoDuplicateFdh(datasetQuads);
    const componentNQuads = await canonicalNQuads(datasetQuads);
    const componentHashInput = concatBytes(utf8(PROFILE_HEADER), utf8(componentNQuads));
    const componentDigest = sha256(componentHashInput);
    const componentUrn = digestToUrn(componentDigest);
    const componentMultibase = urnToMultibase(componentUrn);
    // step 9 — member hashes: H(memberHeader ‖ X_raw ‖ uvarint(i)); X_raw = raw digest bytes
    const memberUrns = [];
    const out = new Map();
    for (const [i, { m }] of keyed.entries()) {
        const hashInput = concatBytes(utf8(MEMBER_HEADER), componentDigest, uvarint(i));
        const urn = digestToUrn(sha256(hashInput));
        memberUrns.push(urn);
        const multibase = urnToMultibase(urn);
        out.set(m, {
            name: m.name,
            urn,
            multibase,
            servingUrl: servingPath(multibase, host),
            kind: 'member',
            // the component's canonical bytes are what a server serves for any member (§6 step 9)
            canonicalNQuads: componentNQuads,
            hashInput,
            component: {
                urn: componentUrn,
                multibase: componentMultibase,
                index: i,
                size: keyed.length,
                memberUrns,
            },
        });
    }
    return out;
}
function assertCanonicalSize(nquads, name) {
    const bytes = Buffer.byteLength(nquads, 'utf8');
    if (bytes > CAPS.maxCanonicalBytes) {
        throw new ConceptHashError(ERR.CAPS, `record ${name}: canonical size ${bytes} bytes exceeds ${CAPS.maxCanonicalBytes} (cap, §5)`);
    }
}
// ---- registration + molecule depth (§3.5 rule 5) ---------------------------------------
function finishRecord(w, minted, registry, results, aliasOut, sameSccFocuses) {
    const status = statusName(w.summary.status);
    // referenced concepts: axiom/explication refs (resolved) + grounding refs.
    // Same-SCC references are excluded from the molecule-depth fold (the +1
    // recursion is ill-founded on a cycle; grounding refs can never be
    // intra-SCC per §3.5 rule 4 — DEVIATIONS.md D6).
    const referenced = new Set();
    for (const iri of namedNodesIn(w.extracted.quads)) {
        const resolvedIri = w.externalSubs.get(iri) ?? iri;
        if (resolvedIri.startsWith('urn:concept:'))
            referenced.add(resolvedIri);
    }
    for (const dep of w.intraDeps) {
        if (sameSccFocuses.has(dep))
            continue;
        const depName = dep.slice(MINT_SCHEME.length);
        const r = results.get(depName);
        if (r !== undefined)
            referenced.add(r.urn);
    }
    for (const g of w.summary.groundingRefs)
        referenced.add(g);
    let depth = 0;
    for (const urn of referenced)
        depth = Math.max(depth, registry.depthOf(urn));
    if (status === 'Molecule')
        depth += 1;
    if (depth > CAPS.maxMoleculeDepth) {
        throw new ConceptHashError(ERR.MOLECULE_DEPTH, `record ${w.name}: molecule depth ${depth} exceeds ${CAPS.maxMoleculeDepth} (§3.5 rule 5)`);
    }
    let primeName;
    if (status === 'Prime') {
        const focus = { termType: 'NamedNode', value: w.focus };
        const idx = Number(w.index.one(focus, CHART_INDEX).value);
        primeName = PRIME_BY_INDEX.get(idx)?.name;
    }
    const record = {
        ...minted,
        status,
        moleculeDepth: depth,
    };
    results.set(w.name, record);
    aliasOut.set(w.name, record.urn);
    registry.register(record.urn, primeName === undefined
        ? { status, moleculeDepth: depth }
        : { status, moleculeDepth: depth, primeName });
}
function statusName(statusIri) {
    if (statusIri === STATUS_PRIME)
        return 'Prime';
    if (statusIri === STATUS_MOLECULE)
        return 'Molecule';
    if (statusIri === STATUS_EXPLICATED)
        return 'Explicated';
    return 'AxiomsOnly';
}
// ---- Tarjan SCC ---------------------------------------------------------------------------
/**
 * Tarjan's strongly-connected-components algorithm (iterative). Emits SCCs
 * in reverse topological order of the condensation (dependencies first).
 */
export function tarjanSccs(nodes, edges) {
    const indexOf = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    const sccs = [];
    let counter = 0;
    for (const root of nodes) {
        if (indexOf.has(root))
            continue;
        const frames = [
            { node: root, neighbors: edges(root).filter((n) => n !== root), i: 0 },
        ];
        indexOf.set(root, counter);
        lowlink.set(root, counter);
        counter += 1;
        stack.push(root);
        onStack.add(root);
        while (frames.length > 0) {
            const frame = frames[frames.length - 1];
            if (frame === undefined)
                break;
            const { node } = frame;
            if (frame.i < frame.neighbors.length) {
                const next = frame.neighbors[frame.i];
                frame.i += 1;
                if (next === undefined)
                    continue;
                if (!indexOf.has(next)) {
                    indexOf.set(next, counter);
                    lowlink.set(next, counter);
                    counter += 1;
                    stack.push(next);
                    onStack.add(next);
                    frames.push({ node: next, neighbors: edges(next).filter((n) => n !== next), i: 0 });
                }
                else if (onStack.has(next)) {
                    const nl = indexOf.get(next);
                    const ll = lowlink.get(node);
                    if (nl !== undefined && ll !== undefined && nl < ll)
                        lowlink.set(node, nl);
                }
            }
            else {
                frames.pop();
                const parent = frames[frames.length - 1];
                if (parent !== undefined) {
                    const ll = lowlink.get(node);
                    const pl = lowlink.get(parent.node);
                    if (ll !== undefined && pl !== undefined && ll < pl)
                        lowlink.set(parent.node, ll);
                }
                if (lowlink.get(node) === indexOf.get(node)) {
                    const scc = [];
                    while (true) {
                        const popped = stack.pop();
                        if (popped === undefined)
                            break;
                        onStack.delete(popped);
                        scc.push(popped);
                        if (popped === node)
                            break;
                    }
                    sccs.push(scc);
                }
            }
        }
    }
    return sccs;
}
