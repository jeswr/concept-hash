/**
 * RDF parsing via N3.js (never hand-rolled), with a hard input-size guard
 * on the untrusted surface (attacker-supplied definitions; §11 of the
 * design doc — fail closed before parsing).
 */
import { type Quad } from './quads.js';
/** Hard cap on any parsed input document (well above the 64 KiB record and
 * 32×64 KiB component caps, small enough to bound hostile parse work). */
export declare const MAX_INPUT_BYTES: number;
export type RdfFormat = 'text/turtle' | 'application/n-quads' | 'application/trig';
export declare function formatForPath(path: string): RdfFormat;
/** Parse an RDF document (size-guarded, fail-closed). */
export declare function parseRdf(input: string, format?: RdfFormat): Quad[];
