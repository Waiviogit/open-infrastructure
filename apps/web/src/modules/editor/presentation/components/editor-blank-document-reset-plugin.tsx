'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HISTORY_MERGE_TAG } from 'lexical';
import { useEffect } from 'react';

import {
  $blankDocumentKeepsFormatting,
  $isBlankDocument,
  $resetBlankDocument,
} from '../../application/blank-document';

/**
 * When the author deletes everything, the editor starts over as plain text: Lexical would keep
 * the first block's type (an empty heading) and the deleted text's bold / italic for the next
 * keystroke. Runs only on the step that empties the document, so Ctrl+B on an already empty
 * editor still works. Merged into the deletion's history entry: one Undo brings the text back.
 */
export function EditorBlankDocumentResetPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
        if (tags.has(HISTORY_MERGE_TAG)) {
          return;
        }
        if (prevEditorState.read($isBlankDocument)) {
          return;
        }
        if (!editorState.read($blankDocumentKeepsFormatting)) {
          return;
        }
        editor.update($resetBlankDocument, { tag: HISTORY_MERGE_TAG });
      }),
    [editor],
  );

  return null;
}
