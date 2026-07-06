// AUTHORED-BY Claude Fable 5
declare module 'rdf-canonize' {
  export interface CanonizeTerm {
    termType: 'NamedNode' | 'BlankNode' | 'Literal' | 'DefaultGraph';
    value: string;
    datatype?: { termType: 'NamedNode'; value: string };
    language?: string;
  }
  export interface CanonizeQuad {
    subject: CanonizeTerm;
    predicate: CanonizeTerm;
    object: CanonizeTerm;
    graph: CanonizeTerm;
  }
  export interface CanonizeOptions {
    algorithm: 'RDFC-1.0' | 'URDNA2015';
    messageDigestAlgorithm?: string;
    maxWorkFactor?: number;
    maxDeepIterations?: number;
    canonicalIdMap?: Map<string, string>;
    format?: string;
    inputFormat?: string;
  }
  export function canonize(
    dataset: CanonizeQuad[] | string,
    options: CanonizeOptions,
  ): Promise<string>;
  export const NQuads: {
    serializeQuad(quad: CanonizeQuad): string;
    serialize(dataset: CanonizeQuad[]): string;
    parse(input: string): CanonizeQuad[];
  };
  const _default: {
    canonize: typeof canonize;
    NQuads: typeof NQuads;
  };
  export default _default;
}
