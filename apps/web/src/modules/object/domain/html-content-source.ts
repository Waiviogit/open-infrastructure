import { HTML_EDITOR_CODE_LANGUAGE } from './html-object.constants';

const MIN_FENCE_LENGTH = 3;

/** A whole value wrapped in one markdown fence: ```lang\n…\n``` (legacy editor output). */
const WRAPPING_FENCE_REGEX = /^(`{3,}|~{3,})[ \t]*[\w+.-]*[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/;

/** A whole value wrapped in `<pre><code>…</code></pre>` with escaped markup. */
const PRE_CODE_WRAPPER_REGEX = /^<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>$/i;

const ESCAPED_ENTITY_REGEX = /&(lt|gt|amp|quot|#39);/;
const REAL_TAG_REGEX = /<[a-z!/]/i;
const HTML_TAG_REGEX = /<\s*(!doctype|[a-z][a-z0-9-]*)(\s|>|\/)/i;

const ENTITY_MAP: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&amp;': '&',
};

function decodeBasicEntities(value: string): string {
  return value.replace(/&(lt|gt|quot|#39|amp);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

/**
 * The HTML page stored in an `htmlContent` update, without the wrappers legacy editors added:
 * a markdown code fence (```javascript … ```), a `<pre><code>` block, or fully escaped markup.
 */
export function normalizeHtmlContentSource(raw: string | null | undefined): string {
  let value = (raw ?? '').replace(/^\uFEFF/, '').trim();

  const fence = value.match(WRAPPING_FENCE_REGEX);
  if (fence) {
    value = (fence[2] ?? '').trim();
  }

  const preCode = value.match(PRE_CODE_WRAPPER_REGEX);
  if (preCode) {
    value = decodeBasicEntities(preCode[1] ?? '').trim();
  }

  if (ESCAPED_ENTITY_REGEX.test(value) && !REAL_TAG_REGEX.test(value)) {
    value = decodeBasicEntities(value).trim();
  }

  return value;
}

/** Whether the text contains at least one HTML tag (the only content an `html` object renders). */
export function looksLikeHtmlSource(source: string): boolean {
  return HTML_TAG_REGEX.test(source);
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  for (const match of value.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

/**
 * Markdown that seeds the editor with the HTML source in one `html` code block. The fence is longer
 * than any backtick run in the source, so the code block survives the round trip verbatim.
 */
export function buildHtmlEditorMarkdown(source: string): string {
  const fence = '`'.repeat(Math.max(MIN_FENCE_LENGTH, longestBacktickRun(source) + 1));
  return `${fence}${HTML_EDITOR_CODE_LANGUAGE}\n${source}\n${fence}`;
}

/**
 * Whether a fenced body holds another fence line: then it is several blocks (with text between
 * them), not one. The editor always picks a fence longer than any backtick run inside its code.
 */
function containsFenceLine(content: string, fence: string): boolean {
  return content.split(/\r?\n/).some((line) => line.trimStart().startsWith(fence));
}

export type HtmlEditorExtractError = 'empty' | 'code_block_required' | 'not_html';

export type HtmlEditorExtractResult =
  | { ok: true; html: string }
  | { ok: false; error: HtmlEditorExtractError };

/**
 * HTML source from the editor's markdown body. The page must sit in one code block: text outside a
 * code block is markdown, whose escaping would corrupt markup and scripts.
 */
export function extractHtmlFromEditorMarkdown(markdown: string): HtmlEditorExtractResult {
  const body = markdown.trim();
  if (body.length === 0) {
    return { ok: false, error: 'empty' };
  }

  const fence = body.match(WRAPPING_FENCE_REGEX);
  if (!fence || containsFenceLine(fence[2] ?? '', fence[1] ?? '')) {
    return { ok: false, error: 'code_block_required' };
  }

  const html = (fence[2] ?? '').trim();
  if (html.length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (!looksLikeHtmlSource(html)) {
    return { ok: false, error: 'not_html' };
  }
  return { ok: true, html };
}
