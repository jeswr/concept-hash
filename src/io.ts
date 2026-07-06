// AUTHORED-BY Claude Fable 5
/**
 * RDF parsing via N3.js (never hand-rolled), with a hard input-size guard
 * on the untrusted surface (attacker-supplied definitions; §11 of the
 * design doc — fail closed before parsing).
 */

import { Parser } from 'n3';
import { fromRdfjs, type Quad } from './quads.js';
import { ConceptHashError, ERR } from './vocab.js';

/** Hard cap on any parsed input document (well above the 64 KiB record and
 * 32×64 KiB component caps, small enough to bound hostile parse work). */
export const MAX_INPUT_BYTES = 4 * 1024 * 1024;

export type RdfFormat = 'text/turtle' | 'application/n-quads' | 'application/trig';

export function formatForPath(path: string): RdfFormat {
  if (path.endsWith('.nq') || path.endsWith('.nt')) return 'application/n-quads';
  if (path.endsWith('.trig')) return 'application/trig';
  return 'text/turtle';
}

/** Parse an RDF document (size-guarded, fail-closed). */
export function parseRdf(input: string, format: RdfFormat = 'text/turtle'): Quad[] {
  const bytes = Buffer.byteLength(input, 'utf8');
  if (bytes > MAX_INPUT_BYTES) {
    throw new ConceptHashError(
      ERR.CAPS,
      `input document is ${bytes} bytes — exceeds the ${MAX_INPUT_BYTES}-byte untrusted-input guard`,
    );
  }
  try {
    const parser = new Parser({ format });
    return parser.parse(input).map(fromRdfjs);
  } catch (cause) {
    if (cause instanceof ConceptHashError) throw cause;
    throw new ConceptHashError(
      ERR.SHAPE,
      `RDF parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
