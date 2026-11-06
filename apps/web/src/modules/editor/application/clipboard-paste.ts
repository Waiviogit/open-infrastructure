/** Lexical's own clipboard format (copy inside a Lexical editor). */
export const LEXICAL_CLIPBOARD_TYPE = 'application/x-lexical-editor';

/** `\s` covers the no-break space too. */
const EMPTY_TEXT = /^\s*$/;

/** Clipboard text that is exactly one URL, or `null` for anything else. */
export function singlePastedUrl(data: DataTransfer | null): string | null {
  const text = data?.getData('text/plain').trim() ?? '';
  return text && !/\s/.test(text) ? text : null;
}

/**
 * Clipboard HTML worth importing as rich content: a copied page fragment with
 * text. "Copy image" puts a lone `<img>` there (no text) next to the image file;
 * Word / Google Docs add a picture of the selection next to HTML with text.
 */
export function clipboardHtmlHasText(data: DataTransfer | null): boolean {
  const html = data?.getData('text/html') ?? '';
  if (!html.trim()) {
    return false;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return !EMPTY_TEXT.test(doc.body.textContent ?? '');
}
