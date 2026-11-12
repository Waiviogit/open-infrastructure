/**
 * Plain-text rendering of a markdown (or Hive HTML) body for previews: feed excerpts, SEO
 * descriptions, DM channel previews and quotes. One line, markup removed, spoilers hidden.
 */

/** Shown instead of spoiler content so a preview never reveals it. */
const SPOILER_PLACEHOLDER = '…';

const TABLE_CELL_SEPARATOR = ' · ';

/** Private-use characters frame protected tokens (code, escapes) while markup is stripped. */
const TOKEN_OPEN = '\uE000';
const TOKEN_CLOSE = '\uE001';
const TOKEN_CHARS_RE = /[\uE000\uE001]/g;
const TOKEN_RE = /\uE000(\d+)\uE001/g;

/** Word characters for intraword `_` (ASCII word chars plus Latin, Greek, Cyrillic, CJK … letters). */
const WORD = String.raw`0-9A-Za-z_\u00C0-\u024F\u0370-\u1FFF\u2C00-\uD7FF`;
/** Link destination; allows one level of balanced parentheses (`/wiki/Foo_(bar)`). */
const DESTINATION = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`;

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE_RE = /(^|[^\\`])(`+)(?!`)([^\n]*?[^`\n])\2(?!`)/g;
const ESCAPE_RE = /\\([!-/:-@[-`{-~])/g;
const SPOILER_RE = /\|\|(?!\|)([\s\S]+?)\|\|/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const AUTOLINK_RE = /<((?:https?|mailto):[^\s<>]+)>/gi;
const HTML_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;

const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const SETEXT_UNDERLINE_RE = /^ {0,3}=+[ \t]*$/;
const LINK_DEFINITION_RE = /^ {0,3}\[[^\]]+\]:\s*\S+/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const HEADING_RE = /^\s{0,3}#{1,6}(?:\s+|$)/;
const HEADING_CLOSING_RE = /\s+#+\s*$/;
const BLOCKQUOTE_RE = /^\s*(?:>\s?)+/;
const LIST_MARKER_RE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+/;
const TASK_BOX_RE = /^\[[ xX]\]\s+/;

const IMAGE_RE = new RegExp(
  String.raw`!\[[^\]]*\](?:${DESTINATION}|\[[^\]]*\])`,
  'g',
);
const LINK_RE = new RegExp(String.raw`\[([^\]]*)\]${DESTINATION}`, 'g');
const REFERENCE_LINK_RE = /\[([^\]]+)\]\[[^\]]*\]/g;
const STRONG_STAR_RE = /\*\*(?=\S)([^\n]*?\S)\*\*/g;
const STRONG_UNDERSCORE_RE = new RegExp(
  String.raw`(^|[^${WORD}])__(?=\S)([^\n]*?\S)__(?![${WORD}])`,
  'g',
);
const STRIKE_RE = /~~(?=\S)([^\n]*?\S)~~/g;
const EM_STAR_RE = /\*(?=\S)([^*\n]*?\S)\*/g;
const EM_UNDERSCORE_RE = new RegExp(
  String.raw`(^|[^${WORD}])_(?=\S)([^_\n]*?\S)_(?![${WORD}])`,
  'g',
);
const WHITESPACE_RE = /\s+/g;

type TokenStore = string[];

function protect(store: TokenStore, text: string): string {
  store.push(text);
  return `${TOKEN_OPEN}${store.length - 1}${TOKEN_CLOSE}`;
}

function restore(store: TokenStore, text: string): string {
  return text.replace(
    TOKEN_RE,
    (_, index: string) => store[Number(index)] ?? '',
  );
}

function closesFence(line: string, fence: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length >= fence.length &&
    [...trimmed].every((char) => char === fence[0])
  );
}

/** Replaces each fenced code block (fences dropped) with one protected token line. */
function protectFencedCode(store: TokenStore, lines: string[]): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  let code: string[] = [];
  for (const line of lines) {
    if (fence === null) {
      const open = FENCE_OPEN_RE.exec(line);
      if (open) {
        fence = open[1];
        code = [];
      } else {
        out.push(line);
      }
      continue;
    }
    if (closesFence(line, fence)) {
      out.push(protect(store, code.join(' ')));
      fence = null;
      continue;
    }
    code.push(line);
  }
  if (fence !== null) {
    out.push(protect(store, code.join(' ')));
  }
  return out;
}

function stripInlineMarkup(text: string): string {
  return text
    .replace(IMAGE_RE, ' ')
    .replace(LINK_RE, '$1')
    .replace(REFERENCE_LINK_RE, '$1')
    .replace(STRONG_STAR_RE, '$1')
    .replace(STRONG_UNDERSCORE_RE, '$1$2')
    .replace(STRIKE_RE, '$1')
    .replace(EM_STAR_RE, '$1')
    .replace(EM_UNDERSCORE_RE, '$1$2');
}

function isTableSeparator(line: string): boolean {
  return (
    line.includes('|') && line.includes('-') && TABLE_SEPARATOR_RE.test(line)
  );
}

function tableRowToText(row: string): string {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripInlineMarkup(cell).trim())
    .filter((cell) => cell !== '')
    .join(TABLE_CELL_SEPARATOR);
}

function blockLineToText(line: string): string {
  if (
    HR_RE.test(line) ||
    SETEXT_UNDERLINE_RE.test(line) ||
    LINK_DEFINITION_RE.test(line)
  ) {
    return '';
  }
  const withoutHeading = HEADING_RE.test(line)
    ? line.replace(HEADING_RE, '').replace(HEADING_CLOSING_RE, '')
    : line;
  const content = withoutHeading
    .replace(BLOCKQUOTE_RE, '')
    .replace(LIST_MARKER_RE, '')
    .replace(TASK_BOX_RE, '');
  return stripInlineMarkup(content);
}

/** Converts each line; a pipe row stays in a table until a line without a pipe. */
function linesToText(lines: string[]): string[] {
  const unquoted = lines.map((line) => line.replace(BLOCKQUOTE_RE, ''));
  let inTable = false;
  return lines.map((line, index) => {
    const content = unquoted[index];
    if (isTableSeparator(content)) {
      inTable = true;
      return '';
    }
    const next = unquoted[index + 1];
    const startsTable = next !== undefined && isTableSeparator(next);
    inTable =
      content.includes('|') &&
      (inTable || startsTable || content.trim().startsWith('|'));
    return inTable ? tableRowToText(content) : blockLineToText(line);
  });
}

/**
 * Converts markdown to one line of plain text for previews.
 *
 * - Code (fenced and inline) keeps its text; fences and backticks are dropped.
 * - Heading, list, task, blockquote and `hr` markers are dropped.
 * - Table rows become cells joined by ` · `; separator rows are dropped.
 * - Links keep their text; images, HTML tags and comments are dropped.
 * - `||spoiler||` content becomes `…`, so a preview never reveals it.
 * - Emphasis markers are dropped; intraword `_` (`snake_case`, `#my_tag`) is kept.
 * - Markdown escapes (`\#`, `\_`, `\*` …) are unescaped.
 * - Lines and blocks are joined with single spaces; the result is trimmed.
 */
export function markdownToPlainText(markdown: string): string {
  const store: TokenStore = [];
  const lines = markdown
    .replace(TOKEN_CHARS_RE, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const prepared = protectFencedCode(store, lines)
    .join('\n')
    .replace(
      INLINE_CODE_RE,
      (_, prefix: string, _ticks: string, code: string) => {
        return `${prefix}${protect(store, code.trim())}`;
      },
    )
    .replace(ESCAPE_RE, (_, char: string) => protect(store, char))
    .replace(SPOILER_RE, ` ${SPOILER_PLACEHOLDER} `)
    .replace(HTML_COMMENT_RE, ' ')
    .replace(AUTOLINK_RE, '$1')
    .replace(HTML_TAG_RE, ' ');

  const text = linesToText(prepared.split('\n')).join(' ');
  return restore(store, text).replace(WHITESPACE_RE, ' ').trim();
}
