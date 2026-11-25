/** Left behind by lower-casing `İ` (`i` + U+0307); removed so `İstanbul` equals `istanbul`. */
const COMBINING_DOT_ABOVE = /̇/g;

/** Format characters (soft hyphen, zero-width joiners, direction marks): deleted, not spaced. */
const FORMAT_CHARACTERS = /\p{Cf}/gu;

/** An apostrophe between letters or digits (`women's` → `womens`). */
const INNER_APOSTROPHE = /(?<=[\p{L}\p{N}])['’ʼ](?=[\p{L}\p{N}])/gu;

/** Everything that is not a letter, digit or combining mark separates words. */
const WORD_SEPARATOR_RUN = /[^\p{L}\p{N}\p{M}]+/gu;

/**
 * The one normalization for search: applied to every indexed text and to every query, so both
 * sides produce the same words. Output is lower-case words separated by single spaces; it never
 * contains punctuation, so it is safe inside `to_tsquery` and `LIKE` patterns.
 *
 * No accent folding (`café` stays `café`). Text without spaces (CJK, Thai) stays one word.
 * @see docs/apps/query-api/spec/search.md
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(COMBINING_DOT_ABOVE, '')
    .replace(FORMAT_CHARACTERS, '')
    .replace(INNER_APOSTROPHE, '')
    .replace(WORD_SEPARATOR_RUN, ' ')
    .trim();
}
