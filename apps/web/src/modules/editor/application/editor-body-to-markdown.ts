import { imageContentUrlForCid } from '@/config/ipfs-content-url';

import { lexicalStateToMarkdown } from './lexical-state-to-markdown';

/**
 * The one markdown body every editor instance produces (post, draft preview, comment, thread,
 * activity message, DM, note): Lexical JSON → markdown, uploaded images resolved through the
 * IPFS content gateway, pasted image URLs kept as typed.
 */
export function editorBodyToMarkdown(
  bodyLexicalJson: string,
  contentBaseUrl: string | null,
): string {
  const resolveImageUrl = (cid: string, src: string) => {
    if (cid && contentBaseUrl) {
      return imageContentUrlForCid(contentBaseUrl, cid);
    }
    return src.trim();
  };
  return lexicalStateToMarkdown(bodyLexicalJson, { resolveImageUrl }).trim();
}
