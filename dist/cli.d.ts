/**
 * concept-hash CLI — hash / verify / explain (§6, §7 of the design doc).
 *
 *   concept-hash hash <file.ttl…> [--aliases aliases.json] [--host h] [--json]
 *   concept-hash verify <urn:concept:…> <served-file> [--json]
 *   concept-hash explain <name> <file.ttl…> [--aliases aliases.json]
 *
 * One authored record per file; the record's symbolic name is the file
 * basename without extension, and its focus IRI is `urn:x-mint:<name>`.
 * `explain` prints the exact canonical bytes (the hash input, profile
 * header included) for the named record.
 */
export declare function main(argv: string[]): Promise<number>;
