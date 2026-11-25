import { normalizeSearchText } from './normalize-search-text';
import { SEARCH_QUERY_MAX_TOKENS } from './search-text.constants';

/** One character of these scripts is a whole word, so it is searched as a prefix. */
const SINGLE_CHARACTER_WORD =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;

const PREFIX_SUFFIX = ':*';

function characterCount(token: string): number {
  return Array.from(token).length;
}

/**
 * Query string for `to_tsquery('simple', $1)` over `object_search_docs.search_vector`, or `null`
 * when the text has no searchable term.
 *
 * - a token of 2+ characters (or one Han / Kana / Hangul character) → prefix `tok:*`;
 * - a one-character token that is not the last → exact term `tok` (`iphone 5 pro`);
 * - a one-character last token → dropped (a word still being typed);
 * - at most {@link SEARCH_QUERY_MAX_TOKENS} tokens; `null` unless one prefix term remains.
 *
 * Tokens come from {@link normalizeSearchText}, so they hold no `to_tsquery` operators.
 */
export function buildPrefixTsQuery(queryText: string): string | null {
  const normalized = normalizeSearchText(queryText);
  if (normalized.length === 0) {
    return null;
  }
  const tokens = normalized.split(' ').slice(0, SEARCH_QUERY_MAX_TOKENS);
  const lastIndex = tokens.length - 1;
  const terms: string[] = [];
  let hasPrefixTerm = false;

  tokens.forEach((token, index) => {
    if (characterCount(token) >= 2 || SINGLE_CHARACTER_WORD.test(token)) {
      terms.push(`${token}${PREFIX_SUFFIX}`);
      hasPrefixTerm = true;
      return;
    }
    if (index !== lastIndex) {
      terms.push(token);
    }
  });

  return hasPrefixTerm ? terms.join(' & ') : null;
}
