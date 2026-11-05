import { $createCodeNode } from '@lexical/code';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  type LexicalNode,
} from 'lexical';

import { $createLineNode } from '../domain/nodes/line-node';

/** Top-level block holding the caret, or `null` (no range selection). */
function $caretTopLevelBlock(): LexicalNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const anchor = selection.anchor.getNode();
  return anchor.getKey() === 'root' ? null : anchor.getTopLevelElementOrThrow();
}

/**
 * Insert → Line: a horizontal rule goes after the whole current block (code,
 * table, list are never split). On an empty paragraph the rule goes before it
 * and the caret stays there; otherwise a fresh paragraph follows the rule and
 * gets the caret. Call inside `editor.update`.
 */
export function $insertHorizontalRuleAtCaret(): void {
  const block = $caretTopLevelBlock();
  const rule = $createLineNode();
  if (!block) {
    const paragraph = $createParagraphNode();
    $getRoot().append(rule, paragraph);
    paragraph.select();
    return;
  }
  if ($isParagraphNode(block) && block.getTextContentSize() === 0) {
    block.insertBefore(rule);
    block.select();
    return;
  }
  const paragraph = $createParagraphNode();
  block.insertAfter(rule);
  rule.insertAfter(paragraph);
  paragraph.select();
}

/**
 * Insert → Code: the current block becomes a code block. (A text line after a
 * code block that ends the document comes from `$ensureTrailingTextLine`.)
 * Call inside `editor.update`.
 */
export function $convertCaretBlockToCode(): void {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    $setBlocksType(selection, () => $createCodeNode());
  }
}
