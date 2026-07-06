// AUTHORED-BY Claude Fable 5
/**
 * The pinned prime lexicon table — the 65 NSM semantic primes of chart
 * edition NSM-EN-v20-2022, typed by category, in chart order (§4.1 of the
 * design doc). A prime record must byte-match this table
 * (ERR_PRIME_LEXICON_MISMATCH otherwise).
 *
 * Chart indices are 1-based positions in the §4.1 listing; this matches the
 * doc's normative KIND example (chartIndex 7).
 *
 * Names: a prime's `name` is its `~`-joined allolex set as written in §4.1
 * (e.g. `SOMETHING~THING`); its `exponents` are the ordered allolexes.
 */

export const CHART_EDITION_PIN = 'NSM-EN-v20-2022';

export interface PrimeEntry {
  /** Canonical name (allolexes ~-joined, §4.1 spelling). */
  name: string;
  /** Profile category token (local name under cdef:). */
  category: string;
  /** 1-based chart index. */
  chartIndex: number;
  /** Ordered canonical English exponent list (allolexes in chart order). */
  exponents: string[];
}

const p = (
  name: string,
  category: string,
  chartIndex: number,
  exponents?: string[],
): PrimeEntry => ({
  name,
  category,
  chartIndex,
  exponents: exponents ?? name.split('~'),
});

export const PRIMES: readonly PrimeEntry[] = [
  // Substantives
  p('I', 'Substantive', 1),
  p('YOU', 'Substantive', 2),
  p('SOMEONE', 'Substantive', 3),
  p('SOMETHING~THING', 'Substantive', 4),
  p('PEOPLE', 'Substantive', 5),
  p('BODY', 'Substantive', 6),
  // Relational substantives
  p('KIND', 'RelationalSubstantive', 7),
  p('PART', 'RelationalSubstantive', 8),
  // Determiners
  p('THIS', 'Determiner', 9),
  p('THE-SAME', 'Determiner', 10),
  p('OTHER~ELSE~ANOTHER', 'Determiner', 11),
  // Quantifiers
  p('ONE', 'Quantifier', 12),
  p('TWO', 'Quantifier', 13),
  p('SOME', 'Quantifier', 14),
  p('ALL', 'Quantifier', 15),
  p('MUCH~MANY', 'Quantifier', 16),
  p('LITTLE~FEW', 'Quantifier', 17),
  // Evaluators
  p('GOOD', 'Evaluator', 18),
  p('BAD', 'Evaluator', 19),
  // Descriptors
  p('BIG', 'Descriptor', 20),
  p('SMALL', 'Descriptor', 21),
  // Mental predicates
  p('THINK', 'MentalPredicate', 22),
  p('KNOW', 'MentalPredicate', 23),
  p('WANT', 'MentalPredicate', 24),
  p("DON'T-WANT", 'MentalPredicate', 25),
  p('FEEL', 'MentalPredicate', 26),
  p('SEE', 'MentalPredicate', 27),
  p('HEAR', 'MentalPredicate', 28),
  // Speech
  p('SAY', 'Speech', 29),
  p('WORDS', 'Speech', 30),
  p('TRUE', 'Speech', 31),
  // Actions, events, movement
  p('DO', 'Action', 32),
  p('HAPPEN', 'Action', 33),
  p('MOVE', 'Action', 34),
  // Location, existence, specification, possession
  p('BE-SOMEWHERE', 'LocationExistence', 35),
  p('THERE-IS', 'LocationExistence', 36),
  p('BE-SPEC', 'LocationExistence', 37),
  p('IS-MINE', 'LocationExistence', 38),
  // Life and death
  p('LIVE', 'LifeDeath', 39),
  p('DIE', 'LifeDeath', 40),
  // Time
  p('WHEN~TIME', 'Time', 41),
  p('NOW', 'Time', 42),
  p('BEFORE', 'Time', 43),
  p('AFTER', 'Time', 44),
  p('A-LONG-TIME', 'Time', 45),
  p('A-SHORT-TIME', 'Time', 46),
  p('FOR-SOME-TIME', 'Time', 47),
  p('MOMENT', 'Time', 48),
  // Space
  p('WHERE~PLACE', 'Space', 49),
  p('HERE', 'Space', 50),
  p('ABOVE', 'Space', 51),
  p('BELOW', 'Space', 52),
  p('FAR', 'Space', 53),
  p('NEAR', 'Space', 54),
  p('SIDE', 'Space', 55),
  p('INSIDE', 'Space', 56),
  p('TOUCH', 'Space', 57),
  // Logical concepts
  p('NOT', 'Logical', 58),
  p('MAYBE', 'Logical', 59),
  p('CAN', 'Logical', 60),
  p('BECAUSE', 'Logical', 61),
  p('IF', 'Logical', 62),
  // Intensifier, augmentor
  p('VERY', 'Intensifier', 63),
  p('MORE', 'Intensifier', 64),
  // Similarity
  p('LIKE~AS~WAY', 'Similarity', 65),
];

export const PRIME_BY_NAME: ReadonlyMap<string, PrimeEntry> = new Map(
  PRIMES.map((e) => [e.name, e]),
);
export const PRIME_BY_INDEX: ReadonlyMap<number, PrimeEntry> = new Map(
  PRIMES.map((e) => [e.chartIndex, e]),
);

/**
 * The controlled grounding lexicon (§3.5 rule 3): a molecule grounding-note
 * token must be a prime exponent (or one of its closed inflected surface
 * forms / function-word allolexes), closed punctuation, the `[m]` molecule
 * flag, or a linked reference `{urn:concept:…|gloss}`.
 *
 * The design doc defers this table to the profile bundle; the prototype pins
 * a concrete table (DEVIATIONS.md D3). Matching is case-insensitive.
 */
const PRIME_SURFACE_FORMS: readonly string[] = PRIMES.flatMap((e) => e.exponents).map((x) =>
  x.toLowerCase(),
);

/** Closed inflected surface forms of primes admitted in grounding notes. */
const INFLECTED_FORMS: readonly string[] = [
  'things',
  'parts',
  'places',
  'times',
  'kinds',
  'words',
  'ways',
  'sides',
  'moments',
  'bodies',
  'happens',
  'happened',
  'happening',
  'says',
  'said',
  'sees',
  'saw',
  'knows',
  'knew',
  'thinks',
  'thought',
  'wants',
  'wanted',
  'does',
  'did',
  'doing',
  'moves',
  'moved',
  'lives',
  'lived',
  'dies',
  'died',
  'touches',
  'touched',
  'cannot',
  "can't",
  "don't",
  'not',
];

/** Closed function-word allolexes admitted in grounding notes. */
const FUNCTION_WORDS: readonly string[] = [
  'a',
  'an',
  'the',
  'of',
  'in',
  'at',
  'on',
  'to',
  'it',
  'its',
  'is',
  'are',
  'was',
  'were',
  'be',
  'being',
  'been',
  'these',
  'those',
  'that',
  'there',
  'they',
  'them',
  'their',
  'this',
  'if',
  'when',
  'because',
  'like',
  'as',
  'so',
  'with',
  'about',
  'who',
  'what',
  'where',
];

export const GROUNDING_LEXICON: ReadonlySet<string> = new Set([
  ...PRIME_SURFACE_FORMS,
  ...INFLECTED_FORMS,
  ...FUNCTION_WORDS,
]);

/** Closed punctuation set for grounding notes (matched per-character). */
export const GROUNDING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  "'",
  '"',
  '(',
  ')',
  '-',
  '?',
  '!',
]);

/** The literal molecule-flag token, admitted verbatim in grounding notes. */
export const MOLECULE_FLAG_TOKEN = '[m]';
