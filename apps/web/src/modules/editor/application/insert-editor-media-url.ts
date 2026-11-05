import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';

import { $createVideoNodeForUrl } from '../domain/nodes/video-node';

/**
 * Inserts a supported video URL as an embedded player block (legacy parity) and
 * puts the caret in a paragraph after it. Call inside `editor.update`.
 * Returns `false` (nothing inserted) for URLs that are not video links.
 */
export function $insertVideoAtSelection(url: string): boolean {
  const video = $createVideoNodeForUrl(url);
  if (!video) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertNodes([video]);
  } else {
    $getRoot().append(video);
  }
  const next = video.getNextSibling();
  if (next) {
    next.selectStart();
  } else {
    const paragraph = $createParagraphNode();
    video.insertAfter(paragraph);
    paragraph.selectStart();
  }
  return true;
}

/** Stored markdown is the public URL; the post renderer turns it into an iframe. */
export function insertMediaUrlAtSelection(editor: LexicalEditor, url: string): boolean {
  let inserted = false;
  editor.update(() => {
    inserted = $insertVideoAtSelection(url);
  });
  return inserted;
}
