'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from 'lexical';
import { useEffect } from 'react';

import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { fetchSearchObjectsByIds } from '@/modules/app-header/infrastructure/search.client';

import { extractPastedObjectIds } from '../../application/extract-pasted-object-ids';

export type EditorPasteObjectLinksPluginProps = {
  onObjectLinkedFromEditor: (result: SearchObjectResult) => void;
};

/**
 * Pasted links to `/object/<id>` attach those objects to the post (legacy parity).
 * Observes paste only — Lexical still inserts the content (links stay in the body).
 */
export function EditorPasteObjectLinksPlugin({
  onObjectLinkedFromEditor,
}: EditorPasteObjectLinksPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const data = event instanceof ClipboardEvent ? event.clipboardData : null;
          const ids = data
            ? extractPastedObjectIds(data.getData('text/html'), data.getData('text/plain'))
            : [];
          if (ids.length > 0) {
            void fetchSearchObjectsByIds(ids)
              .then((objects) => {
                for (const object of objects ?? []) {
                  onObjectLinkedFromEditor(object);
                }
              })
              .catch(() => undefined);
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    [editor, onObjectLinkedFromEditor],
  );

  return null;
}
