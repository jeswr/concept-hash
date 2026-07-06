// AUTHORED-BY Claude Fable 5
/**
 * Verify-by-recompute (§7 of the design doc, byte-pinned):
 *
 * - select the path from the served form: a single default-graph record ⇒
 *   singleton; a named-graph dataset ⇒ component; anything else ⇒ reject
 * - served bytes must already be canonical — non-NFC / non-canonical-lexical /
 *   non-lowercase-langtag content is REJECTED, never normalized; for
 *   application/n-quads the served bytes must equal the canonical bytes
 * - singleton: shape+caps+reserved-token check → recompute §6 step 5 →
 *   byte-compare
 * - component: ≤32 named graphs named exactly #member-0…#member-(n−1),
 *   contiguous, default graph empty, each graph record-shaped within caps →
 *   recompute §6 steps 8–9 (which yields EVERY member URN) → the requested
 *   URN must be in that set. The canonical member ordering (steps 6–7) is
 *   re-checked (DEVIATIONS.md D7).
 *
 * Verification is structural-only (no §4 grammar pass) per the doc's §7.
 */

import { createHash } from 'node:crypto';
import { assertNoDuplicateFdh, canonicalNQuads, isLiteralCanonical, type Quad } from './quads.js';
import { extractRecord, RecordIndex, substituteIris } from './record.js';
import { digestToUrn, isConceptUrn, parseConceptUrn, uvarint } from './urn.js';
import { assertLiteralWhitelist, validateRecordShape } from './validate.js';
import {
  ALL_PROFILE_TERMS,
  CAPS,
  ConceptHashError,
  ERR,
  INTRA,
  MEMBER_HEADER,
  MINT_SCHEME,
  memberIri,
  PROFILE_HEADER,
  SELF,
} from './vocab.js';

export interface VerifyOptions {
  /**
   * When the served bytes are application/n-quads, pass them here for the
   * exact byte-compare (the strongest §7 check).
   */
  servedNQuads?: string;
}

export interface VerifyResult {
  ok: true;
  kind: 'singleton' | 'component-member' | 'component';
  urn: string;
  componentUrn?: string;
  memberIndex?: number;
  memberUrns?: string[];
}

const sha256 = (data: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha256').update(data).digest());
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Verify a served definition representation against a requested URN.
 * Throws ConceptHashError (fail closed) on any mismatch.
 */
export async function verifyServed(
  urn: string,
  quads: Quad[],
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  parseConceptUrn(urn); // requested URN must itself be well-formed
  assertServedTermsCanonical(quads);

  const namedGraphs = new Set<string>();
  let defaultGraphQuads = 0;
  for (const q of quads) {
    if (q.graph.termType === 'DefaultGraph') defaultGraphQuads += 1;
    else if (q.graph.termType === 'NamedNode') namedGraphs.add(q.graph.value);
    else throw new ConceptHashError(ERR.VERIFY, 'blank-node graph names are not record-shaped');
  }

  if (namedGraphs.size === 0) {
    return verifySingleton(urn, quads, options);
  }
  if (defaultGraphQuads > 0) {
    throw new ConceptHashError(
      ERR.VERIFY,
      'a component dataset must have an EMPTY default graph (§6 step 8)',
    );
  }
  return verifyComponent(urn, quads, namedGraphs, options);
}

// ---- singleton (§7) --------------------------------------------------------------

async function verifySingleton(
  urn: string,
  quads: Quad[],
  options: VerifyOptions,
): Promise<VerifyResult> {
  const extracted = extractRecord(quads, SELF, true); // strict: extras REJECT
  assertLiteralWhitelist(extracted.quads);
  const ix = new RecordIndex(extracted);
  validateRecordShape(ix, { allowSymbolicRefs: false });
  assertNoDuplicateFdh(quads);

  const nquads = await canonicalNQuads(quads);
  assertCanonicalSize(nquads);
  assertByteIdentical(nquads, options);

  const computed = digestToUrn(sha256(concatBytes(utf8(PROFILE_HEADER), utf8(nquads))));
  if (computed !== urn) {
    throw new ConceptHashError(
      ERR.VERIFY,
      `recomputed URN ${computed} does not match requested ${urn}`,
    );
  }
  return { ok: true, kind: 'singleton', urn };
}

// ---- component (§7) ---------------------------------------------------------------

async function verifyComponent(
  urn: string,
  quads: Quad[],
  namedGraphs: Set<string>,
  options: VerifyOptions,
): Promise<VerifyResult> {
  const n = namedGraphs.size;
  if (n < 2 || n > CAPS.maxSccSize) {
    throw new ConceptHashError(
      ERR.VERIFY,
      `component must have 2..${CAPS.maxSccSize} member graphs, found ${n}`,
    );
  }
  for (let i = 0; i < n; i++) {
    if (!namedGraphs.has(memberIri(i))) {
      throw new ConceptHashError(
        ERR.VERIFY,
        `member graphs must be named exactly #member-0…#member-${n - 1} (contiguous); missing #member-${i}`,
      );
    }
  }

  const memberFoci = new Set<string>();
  for (let i = 0; i < n; i++) memberFoci.add(memberIri(i));
  assertComponentReferenceDiscipline(quads, memberFoci);

  // Each member graph must be record-shaped within caps (§7). Shape-check via
  // the singleton machinery: own #member-i → #self; other #member-j → a
  // tool-generated symbolic placeholder (authored urn:x-mint: content was
  // rejected above, so no collision is possible).
  const memberQuads: Quad[][] = [];
  for (let i = 0; i < n; i++) {
    const graphIri = memberIri(i);
    const inGraph = quads
      .filter((q) => q.graph.termType === 'NamedNode' && q.graph.value === graphIri)
      .map((q): Quad => ({ ...q, graph: { termType: 'DefaultGraph', value: '' } }));
    memberQuads.push(inGraph);
    const mapping = new Map<string, string>();
    for (let j = 0; j < n; j++) {
      mapping.set(memberIri(j), j === i ? SELF : `${MINT_SCHEME}member-${j}`);
    }
    const shapeView = substituteIris(inGraph, mapping);
    const extracted = extractRecord(shapeView, SELF, true);
    assertLiteralWhitelist(extracted.quads);
    validateRecordShape(new RecordIndex(extracted), { allowSymbolicRefs: true });
  }

  // duplicate-FDH rule over the whole component dataset (§6 step 8)
  assertNoDuplicateFdh(quads);

  // Canonical member ordering re-check (steps 6–7; DEVIATIONS.md D7): the
  // ordering keys of members 0…n−1 must be strictly increasing.
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const mapping = new Map<string, string>();
    for (let j = 0; j < n; j++) mapping.set(memberIri(j), j === i ? SELF : INTRA);
    const own = memberQuads[i];
    if (own === undefined) continue;
    const rewritten = substituteIris(own, mapping);
    const nq = await canonicalNQuads(rewritten);
    assertCanonicalSize(nq);
    keys.push(Buffer.from(sha256(concatBytes(utf8(PROFILE_HEADER), utf8(nq)))).toString('hex'));
  }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (a !== undefined && b !== undefined && !(a < b)) {
      throw new ConceptHashError(
        ERR.VERIFY,
        `member indices do not follow the canonical ordering-key sort (§6 steps 6–7): key[${i - 1}] ≥ key[${i}]`,
      );
    }
  }

  // steps 8–9 recompute
  const componentNQuads = await canonicalNQuads(quads);
  assertByteIdentical(componentNQuads, options);
  const componentDigest = sha256(concatBytes(utf8(PROFILE_HEADER), utf8(componentNQuads)));
  const componentUrn = digestToUrn(componentDigest);
  const memberUrns: string[] = [];
  for (let i = 0; i < n; i++) {
    memberUrns.push(
      digestToUrn(sha256(concatBytes(utf8(MEMBER_HEADER), componentDigest, uvarint(i)))),
    );
  }

  if (urn === componentUrn) {
    return { ok: true, kind: 'component', urn, componentUrn, memberUrns };
  }
  const memberIndex = memberUrns.indexOf(urn);
  if (memberIndex === -1) {
    throw new ConceptHashError(
      ERR.VERIFY,
      `requested URN ${urn} is neither the component URN nor any of its ${n} member URNs`,
    );
  }
  return { ok: true, kind: 'component-member', urn, componentUrn, memberIndex, memberUrns };
}

// ---- served-bytes canonicality (§7) --------------------------------------------------

/** Reject non-NFC IRIs, non-canonical literals and non-lowercase langtags. */
function assertServedTermsCanonical(quads: Quad[]): void {
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object, q.graph]) {
      if (t.termType === 'NamedNode' && t.value !== t.value.normalize('NFC')) {
        throw new ConceptHashError(
          ERR.NOT_CANONICAL,
          `served IRI <${t.value}> is not NFC (§7: reject, never normalize)`,
        );
      }
      if (t.termType === 'Literal') {
        try {
          if (!isLiteralCanonical(t)) {
            throw new ConceptHashError(
              ERR.NOT_CANONICAL,
              `served literal ${JSON.stringify(t.value)} is not in canonical form (§7: reject, never normalize)`,
            );
          }
        } catch (cause) {
          if (cause instanceof ConceptHashError && cause.code === ERR.NOT_CANONICAL) throw cause;
          throw new ConceptHashError(
            ERR.NOT_CANONICAL,
            `served literal ${JSON.stringify(t.value)} has an invalid lexical form`,
          );
        }
      }
    }
  }
}

/**
 * Reserved-token discipline for served component datasets (§5): no
 * urn:x-mint: anywhere; the urn:concept-def: namespace may contribute only
 * profile-vocabulary terms and #member-i in the positions step 8 generates
 * (graph names, subjects, reference objects). #self and #intra must NOT
 * appear inside a component.
 */
function assertComponentReferenceDiscipline(quads: Quad[], memberFoci: Set<string>): void {
  for (const q of quads) {
    for (const t of [q.subject, q.predicate, q.object]) {
      if (t.termType !== 'NamedNode') continue;
      const v = t.value;
      if (v.startsWith(MINT_SCHEME)) {
        throw new ConceptHashError(
          ERR.VERIFY,
          `served content contains a symbolic reference <${v}>`,
        );
      }
      if (v.startsWith('urn:concept-def:')) {
        if (memberFoci.has(v)) continue;
        if (ALL_PROFILE_TERMS.has(v)) continue;
        throw new ConceptHashError(
          ERR.RESERVED_TOKEN,
          `<${v}> is not a legal token inside a component dataset (§5 reservation; #self/#intra never appear in step-8 output)`,
        );
      }
      if (v.startsWith('urn:concept:') && !isConceptUrn(v)) {
        throw new ConceptHashError(
          ERR.REFERENCE_SYNTAX,
          `<${v}> is not a valid urn:concept: reference`,
        );
      }
    }
  }
}

function assertByteIdentical(recomputed: string, options: VerifyOptions): void {
  if (options.servedNQuads !== undefined && options.servedNQuads !== recomputed) {
    throw new ConceptHashError(
      ERR.NOT_CANONICAL,
      'served application/n-quads bytes are not the canonical bytes for this record (§7: exactly one byte representation exists per URN)',
    );
  }
}

function assertCanonicalSize(nquads: string): void {
  const bytes = Buffer.byteLength(nquads, 'utf8');
  if (bytes > CAPS.maxCanonicalBytes) {
    throw new ConceptHashError(
      ERR.CAPS,
      `canonical record size ${bytes} exceeds ${CAPS.maxCanonicalBytes} (cap, §5)`,
    );
  }
}
