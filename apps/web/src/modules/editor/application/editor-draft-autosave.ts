import { hasLexicalDraftBodyContent } from './editor-body-serialization';

/**
 * A new draft is created only for something the author wrote or attached: a
 * title, body content or linked objects. Defaults every new post has (the
 * `waivio` tag, the default beneficiary, an empty Lexical paragraph) do not
 * count, so opening and leaving the editor never leaves an empty draft behind.
 */
export function hasDraftWorthSaving(input: {
  title: string;
  body: string;
  linkedObjectCount: number;
}): boolean {
  return (
    input.title.trim().length > 0 ||
    hasLexicalDraftBodyContent(input.body) ||
    input.linkedObjectCount > 0
  );
}
