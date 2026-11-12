import { ACTIVITY_NOTE_BODY_MAX_CHARS } from './activity-notes.constants';

/** `#note=<encodeURIComponent(markdown)>` — the whole note, used verbatim. */
export const ACTIVITY_NOTE_IMPORT_NOTE_PARAM = 'note';
/** Legacy form: `#top=<markdown>&v=<text>&v=<text>…` (context block + copyable variants). */
export const ACTIVITY_NOTE_IMPORT_TOP_PARAM = 'top';
export const ACTIVITY_NOTE_IMPORT_VARIANT_PARAM = 'v';

const MIN_FENCE_LENGTH = 3;
const ALPHABET_SIZE = 26;
const LETTER_A_CODE = 'A'.charCodeAt(0);

/** A, B, …, Z, AA, AB, … */
export function variantLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(LETTER_A_CODE + (n % ALPHABET_SIZE)) + label;
    n = Math.floor(n / ALPHABET_SIZE) - 1;
  } while (n >= 0);
  return label;
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

/** A fenced code block whose fence is longer than any backtick run inside `text`. */
export function fencedCodeBlock(text: string): string {
  const fence = '`'.repeat(Math.max(MIN_FENCE_LENGTH, longestBacktickRun(text) + 1));
  return `${fence}\n${text}\n${fence}`;
}

function buildLegacyMarkdown(top: string, variants: readonly string[]): string {
  const blocks: string[] = [];
  if (top) {
    blocks.push(top);
  }
  variants.forEach((variant, index) => {
    blocks.push(`**${variantLabel(index)}**\n${fencedCodeBlock(variant)}`);
  });
  return blocks.join('\n\n');
}

function finalize(markdown: string): string | null {
  const trimmed = markdown.trim();
  if (!trimmed || trimmed.length > ACTIVITY_NOTE_BODY_MAX_CHARS) {
    return null;
  }
  return trimmed;
}

/**
 * Agent import link → note markdown, or `null` when the hash carries no importable note.
 *
 * - `note` wins when present and is used verbatim (trimmed).
 * - Otherwise `top` (optional) plus each non-blank `v` as `**A**` + a fenced code block.
 * - Empty or longer than {@link ACTIVITY_NOTE_BODY_MAX_CHARS} after trimming → `null`.
 *
 * @see docs/apps/web/spec/activity-notes.md
 */
export function parseActivityNoteImportHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return null;
  }
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  if (params.has(ACTIVITY_NOTE_IMPORT_NOTE_PARAM)) {
    return finalize(params.get(ACTIVITY_NOTE_IMPORT_NOTE_PARAM) ?? '');
  }

  const top = (params.get(ACTIVITY_NOTE_IMPORT_TOP_PARAM) ?? '').trim();
  const variants = params
    .getAll(ACTIVITY_NOTE_IMPORT_VARIANT_PARAM)
    .filter((variant) => variant.trim() !== '');
  if (!top && variants.length === 0) {
    return null;
  }
  return finalize(buildLegacyMarkdown(top, variants));
}
