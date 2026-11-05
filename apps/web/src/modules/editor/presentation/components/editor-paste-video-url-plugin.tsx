'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from 'lexical';
import { useEffect } from 'react';

import { parseMediaEmbedUrl } from '@/shared/infrastructure/media-embed';

import { $insertVideoAtSelection } from '../../application/insert-editor-media-url';

/** Single-URL clipboard text, or `null` when the paste is anything else. */
function singlePastedUrl(event: ClipboardEvent | KeyboardEvent | InputEvent): string | null {
  if (!(event instanceof ClipboardEvent)) {
    return null;
  }
  const text = event.clipboardData?.getData('text/plain').trim() ?? '';
  return text && !/\s/.test(text) ? text : null;
}

/** Legacy parity: pasting a lone video link inserts the embedded player. */
export function EditorPasteVideoUrlPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const url = singlePastedUrl(event);
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
