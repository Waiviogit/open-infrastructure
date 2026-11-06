'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from 'lexical';
import { useEffect } from 'react';

import { parseMediaEmbedUrl } from '@/shared/infrastructure/media-embed';

import { singlePastedUrl } from '../../application/clipboard-paste';
import { $insertVideoAtSelection } from '../../application/insert-editor-media-url';

/** Legacy parity: pasting a lone video link inserts the embedded player. */
export function EditorPasteVideoUrlPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const url =
            event instanceof ClipboardEvent ? singlePastedUrl(event.clipboardData) : null;
          if (!url || !parseMediaEmbedUrl(url)) {
            return false;
          }
          event.preventDefault();
          editor.update(() => {
            $insertVideoAtSelection(url);
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );

  return null;
}
