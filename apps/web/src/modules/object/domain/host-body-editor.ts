import {
  buildHtmlEditorMarkdown,
  extractHtmlFromEditorMarkdown,
  type HtmlEditorExtractError,
} from './html-content-source';
import type { HostBodyFormat } from './host-body-tab';

export type HostBodyExtractError = HtmlEditorExtractError;

export type HostBodyExtractResult =
  | { ok: true; body: string }
  | { ok: false; error: HostBodyExtractError };

/** Markdown that seeds the editor: an HTML page sits in one code block, rich text is itself. */
export function buildHostBodyEditorMarkdown(format: HostBodyFormat, source: string): string {
  return format === 'html' ? buildHtmlEditorMarkdown(source) : source;
}

/** The body to publish from the editor's markdown. */
export function extractHostBodyFromEditorMarkdown(
  format: HostBodyFormat,
  markdown: string,
): HostBodyExtractResult {
  if (format === 'html') {
    const extracted = extractHtmlFromEditorMarkdown(markdown);
    return extracted.ok ? { ok: true, body: extracted.html } : extracted;
  }
  const body = markdown.trim();
  return body.length > 0 ? { ok: true, body } : { ok: false, error: 'empty' };
}
