'use client';

import { $insertGeneratedNodes } from '@lexical/clipboard';
import { $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

import { LEXICAL_CLIPBOARD_TYPE } from '../../application/clipboard-paste';
import { normalizePastedHtml } from '../../application/normalize-pasted-html';

/**
 * Rich paste: clipboard HTML (a selection from a rendered post, another site)
 * keeps its blocks and formatting — headings, lists, tables, bold / italic /
 * struck text, links, image and video blocks, lines. Runs after the single-URL
 * and image-file paste plugins; copies made inside the editor keep Lexical's
 * own format.
 */
export function EditorPasteRichHtmlPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const data =
            event instanceof ClipboardEvent ? event.clipboardData : null;
          if (!data || data.types.includes(LEXICAL_CLIPBOARD_TYPE)) {
            return false;
          }
          const html = data.getData('text/html');
          // iOS autocorrect sends its plain text as `text/html` too.
          if (!html.trim() || html === data.getData('text/plain')) {
            return false;
          }
          const selection = $getSelection();
          if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
            return false;
          }
          event.preventDefault();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          normalizePastedHtml(doc);
          $insertGeneratedNodes(
            editor,
            $generateNodesFromDOM(editor, doc),
            selection,
          );
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor],
  );

  return null;
}
