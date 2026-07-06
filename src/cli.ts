// AUTHORED-BY Claude Fable 5
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

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { formatForPath, parseRdf } from './io.js';
import { type AuthoredRecord, mint } from './mint.js';
import { verifyServed } from './verify.js';
import { ConceptHashError } from './vocab.js';

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (key === 'json') {
        flags.set(key, true);
      } else if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next);
        i += 1;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

async function loadRecords(paths: string[]): Promise<AuthoredRecord[]> {
  const records: AuthoredRecord[] = [];
  for (const path of paths) {
    const text = await readFile(path, 'utf8');
    const name = basename(path).replace(/\.(ttl|nq|nt|trig)$/, '');
    records.push({ name, quads: parseRdf(text, formatForPath(path)) });
  }
  return records;
}

async function loadAliases(path: string | undefined): Promise<Record<string, string>> {
  if (path === undefined) return {};
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConceptHashError(
      'ERR_SHAPE',
      'alias table must be a JSON object of name → urn:concept: URN',
    );
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') {
      throw new ConceptHashError('ERR_SHAPE', `alias ${k} must map to a string URN`);
    }
    out[k] = v;
  }
  return out;
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { positional, flags } = parseArgs(rest);
  const json = flags.get('json') === true;

  try {
    switch (command) {
      case 'hash': {
        if (positional.length === 0)
          throw new ConceptHashError('ERR_USAGE', 'hash requires at least one record file');
        const aliases = await loadAliases(str(flags.get('aliases')));
        const host = str(flags.get('host'));
        const records = await loadRecords(positional);
        const result = await mint(records, host === undefined ? { aliases } : { aliases, host });
        if (json) {
          const out: Record<string, unknown> = {};
          for (const [name, r] of result.records) {
            out[name] = {
              urn: r.urn,
              servingUrl: r.servingUrl,
              status: r.status,
              kind: r.kind,
              moleculeDepth: r.moleculeDepth,
              ...(r.component === undefined
                ? {}
                : {
                    component: {
                      urn: r.component.urn,
                      index: r.component.index,
                      size: r.component.size,
                    },
                  }),
            };
          }
          process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
        } else {
          for (const [name, r] of result.records) {
            const extra =
              r.component === undefined
                ? ''
                : `  [member ${r.component.index}/${r.component.size} of ${r.component.urn}]`;
            process.stdout.write(`${name}\n  ${r.urn}\n  ${r.servingUrl}\n  ${r.status}${extra}\n`);
          }
        }
        return 0;
      }
      case 'verify': {
        const [urn, file] = positional;
        if (urn === undefined || file === undefined) {
          throw new ConceptHashError('ERR_USAGE', 'verify requires <urn> <served-file>');
        }
        const text = await readFile(file, 'utf8');
        const format = formatForPath(file);
        const quads = parseRdf(text, format);
        const result = await verifyServed(
          urn,
          quads,
          format === 'application/n-quads' ? { servedNQuads: text } : {},
        );
        if (json) {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        } else {
          const detail =
            result.kind === 'component-member'
              ? ` (member ${result.memberIndex} of ${result.componentUrn})`
              : '';
          process.stdout.write(`OK ${result.kind}${detail}\n${result.urn}\n`);
        }
        return 0;
      }
      case 'explain': {
        const [name, ...files] = positional;
        if (name === undefined || files.length === 0) {
          throw new ConceptHashError('ERR_USAGE', 'explain requires <name> <record-file…>');
        }
        const aliases = await loadAliases(str(flags.get('aliases')));
        const records = await loadRecords(files);
        const result = await mint(records, { aliases });
        const r = result.records.get(name);
        if (r === undefined) {
          throw new ConceptHashError('ERR_USAGE', `no record named ${name} in the mint set`);
        }
        process.stderr.write(`# ${r.urn}\n# kind: ${r.kind}\n`);
        if (r.component !== undefined) {
          process.stderr.write(
            `# member ${r.component.index} of component ${r.component.urn}\n# member hash input = UTF8("urn:concept-def:1#member\\n") ‖ X_raw ‖ uvarint(${r.component.index})\n# component canonical bytes (profile header + canonical N-Quads) follow:\n`,
          );
          process.stdout.write(`urn:concept-def:1\n${r.canonicalNQuads}`);
        } else {
          process.stderr.write('# canonical bytes (profile header + canonical N-Quads) follow:\n');
          process.stdout.write(new TextDecoder().decode(r.hashInput));
        }
        return 0;
      }
      default:
        process.stderr.write(
          'usage: concept-hash <hash|verify|explain> …\n  hash <file.ttl…> [--aliases a.json] [--host h] [--json]\n  verify <urn> <served-file> [--json]\n  explain <name> <file.ttl…> [--aliases a.json]\n',
        );
        return command === undefined || command === 'help' || command === '--help' ? 0 : 2;
    }
  } catch (cause) {
    if (cause instanceof ConceptHashError) {
      process.stderr.write(`${cause.message}\n`);
      return 1;
    }
    throw cause;
  }
}

function str(v: string | true | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
