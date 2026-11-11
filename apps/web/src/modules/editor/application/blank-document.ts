import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
} from 'lexical';

/** No text, media or other blocks left: the root holds a single empty text block. */
export function $isBlankDocument(): boolean {
  const root = $getRoot();
  if (root.getChildrenSize() !== 1) {
    return false;
  }
  const only = root.getFirstChild();
  return (
    $isElementNode(only) &&
    only.getChildrenSize() === 0 &&
    ($isParagraphNode(only) || $isHeadingNode(only) || $isQuoteNode(only))
  );
}

/**
 * A blank document still carrying the style of deleted text: an empty heading / quote, or a
 * paragraph / caret that would type bold, italic, …
 */
export function $blankDocumentKeepsFormatting(): boolean {
  if (!$isBlankDocument()) {
    return false;
  }
  const only = $getRoot().getFirstChild();
  if (!$isParagraphNode(only)) {
    return true;
  }
  if (only.getTextFormat() !== 0 || only.getTextStyle() !== '') {
    return true;
  }
  const selection = $getSelection();
  return $isRangeSelection(selection) && (selection.format !== 0 || selection.style !== '');
}

/** Replaces the blank document with one plain paragraph and puts the caret in it. */
export function $resetBlankDocument(): void {
  const root = $getRoot();
  const paragraph = $createParagraphNode();
  root.clear();
  root.append(paragraph);
  const selection = paragraph.select();
  selection.format = 0;
  selection.style = '';
}
