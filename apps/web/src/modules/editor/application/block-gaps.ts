import { $isCodeNode } from '@lexical/code';
import { $isListNode } from '@lexical/list';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $isTableNode } from '@lexical/table';
import {
  $createParagraphNode,
  $isParagraphNode,
  type ElementNode,
  type LexicalNode,
  type RootNode,
} from 'lexical';

import { $isMediaBlockNode } from '../domain/nodes/media-block';
import { $selectMediaBlockNode } from './image-selection';

/**
 * - `flow`: plain text lines (paragraph, heading, quote, list) — the caret lives here.
 * - `container`: editable but self-contained (table, code) — needs a way out.
 * - `media`: no caret inside (image, video, line) — selected as a whole.
 */
export type BlockKind = 'flow' | 'container' | 'media';

export type BlockSide = 'before' | 'after';

export function $blockKind(node: LexicalNode | null): BlockKind | null {
  if ($isParagraphNode(node) || $isHeadingNode(node) || $isQuoteNode(node) || $isListNode(node)) {
    return 'flow';
  }
  if ($isTableNode(node) || $isCodeNode(node)) {
    return 'container';
  }
  if ($isMediaBlockNode(node)) {
    return 'media';
  }
  return null;
}

/**
 * The document always ends with a text line: after a table, code, image, video
 * or line at the end an empty paragraph is (re)added, so the caret can always get
 * below the last block. Empty paragraphs are dropped on publish.
 */
export function $ensureTrailingTextLine(root: RootNode): void {
  if ($blockKind(root.getLastChild()) !== 'flow') {
    root.append($createParagraphNode());
  }
}

/** Inserts an empty paragraph next to a top-level block and puts the caret in it. */
export function $openLineBeside(block: LexicalNode, side: BlockSide): void {
  const paragraph = $createParagraphNode();
  if (side === 'before') {
    block.insertBefore(paragraph);
  } else {
    block.insertAfter(paragraph);
  }
  paragraph.select();
}

function $enter(neighbour: LexicalNode, side: BlockSide): void {
  if ($isMediaBlockNode(neighbour)) {
    $selectMediaBlockNode(neighbour);
    return;
  }
  const element = neighbour as ElementNode;
  if (side === 'before') {
    element.selectEnd();
  } else {
    element.selectStart();
  }
}

/**
 * Arrow key leaving a top-level `block` through its `side` edge (for media: the
 * block is node-selected; otherwise the caret is on the block's edge line).
 * Returns `false` when Lexical's default caret move is already right.
 *
 * - into an image / video / line → that block gets selected;
 * - out of a media block → the neighbour (caret or selection), or a new line at
 *   the document edge;
 * - out of a table / code block with no text line on that side (document edge,
 *   another table / code, media) → a new line.
 */
export function $leaveBlockAtEdge(block: LexicalNode, side: BlockSide): boolean {
  const neighbour = side === 'before' ? block.getPreviousSibling() : block.getNextSibling();
  const kind = $blockKind(block);
  const neighbourKind = $blockKind(neighbour);

  if (kind === 'media') {
    if (neighbour && neighbourKind) {
      $enter(neighbour, side);
    } else {
      $openLineBeside(block, side);
    }
    return true;
  }
  if ($isMediaBlockNode(neighbour)) {
    $selectMediaBlockNode(neighbour);
    return true;
  }
  if (kind === 'container' && neighbourKind !== 'flow') {
    $openLineBeside(block, side);
    return true;
  }
  return false;
}
