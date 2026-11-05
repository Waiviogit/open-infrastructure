import {
  $createNodeSelection,
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  $isNodeSelection,
  $isTextNode,
  $setSelection,
  type BaseSelection,
  type ElementNode,
  type RangeSelection,
} from 'lexical';

import { $isMediaBlockNode, type MediaBlockNode } from '../domain/nodes/media-block';

/* Image, video and horizontal-rule blocks share selection / Backspace / Delete behavior. */

export function $selectMediaBlockNode(node: MediaBlockNode): void {
  const nodeSelection = $createNodeSelection();
  nodeSelection.add(node.getKey());
  $setSelection(nodeSelection);
}

export function $getSelectedMediaBlockNodes(selection: BaseSelection | null): MediaBlockNode[] {
  if (!$isNodeSelection(selection)) {
    return [];
  }
  return selection.getNodes().filter($isMediaBlockNode);
}

/**
 * Removes selected blocks and puts a range caret where the user was: start of the
 * block after them, else end of the block before, else a new empty paragraph.
 * (Lexical's own `deleteNodes()` leaves a root-level selection that renders the
 * caret at the top of the editor.)
 */
export function $removeMediaBlocksAndPlaceCaret(nodes: readonly MediaBlockNode[]): void {
  if (nodes.length === 0) {
    return;
  }
  const keys = new Set(nodes.map((n) => n.getKey()));
  const last = nodes[nodes.length - 1];
  const first = nodes[0];
  let next = last.getNextSibling();
  while (next && keys.has(next.getKey())) {
    next = next.getNextSibling();
  }
  let prev = first.getPreviousSibling();
  while (prev && keys.has(prev.getKey())) {
    prev = prev.getPreviousSibling();
  }
  for (const node of nodes) {
    node.remove();
  }
  if ($isElementNode(next) && !$isMediaBlockNode(next)) {
    next.selectStart();
    return;
  }
  if ($isElementNode(prev) && !$isMediaBlockNode(prev)) {
    prev.selectEnd();
    return;
  }
  const paragraph = $createParagraphNode();
  if (next) {
    next.insertBefore(paragraph);
  } else {
    $getRoot().append(paragraph);
  }
  paragraph.select();
}

/** Image or video immediately before a collapsed range caret (Backspace selects it). */
export function $getMediaBlockBeforeRange(selection: RangeSelection): MediaBlockNode | null {
  if (!selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  if ($isMediaBlockNode(anchorNode)) {
    return anchorNode;
  }

  if ($isTextNode(anchorNode)) {
    if (selection.anchor.offset > 0) {
      return null;
    }
    const parent = anchorNode.getParent();
    if (parent) {
      const prev = parent.getPreviousSibling();
      if ($isMediaBlockNode(prev)) {
        return prev;
      }
    }
  }

  const topLevel = anchorNode.getTopLevelElement();
  if (!topLevel || $isMediaBlockNode(topLevel)) {
    return null;
  }

  if (!$isCaretAtTopLevelStart(selection, topLevel)) {
    return null;
  }

  const prev = topLevel.getPreviousSibling();
  return $isMediaBlockNode(prev) ? prev : null;
}

/** Image or video immediately after a collapsed range caret (Delete selects it). */
export function $getMediaBlockAfterRange(selection: RangeSelection): MediaBlockNode | null {
  if (!selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  if ($isMediaBlockNode(anchorNode)) {
    return anchorNode;
  }

  if ($isTextNode(anchorNode)) {
    if (selection.anchor.offset < anchorNode.getTextContentSize()) {
      return null;
    }
    const parent = anchorNode.getParent();
    if (parent) {
      const next = parent.getNextSibling();
      if ($isMediaBlockNode(next)) {
        return next;
      }
    }
  }

  const topLevel = anchorNode.getTopLevelElement();
  if (!topLevel || $isMediaBlockNode(topLevel)) {
    return null;
  }

  if (!$isCaretAtTopLevelEnd(selection, topLevel)) {
    return null;
  }

  const next = topLevel.getNextSibling();
  return $isMediaBlockNode(next) ? next : null;
}

function $isCaretAtTopLevelStart(
  selection: RangeSelection,
  topLevel: ElementNode,
): boolean {
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();

  if (anchorNode === topLevel && anchor.type === 'element' && anchor.offset === 0) {
    return true;
  }

  if ($isTextNode(anchorNode) && anchor.offset === 0) {
    const parent = anchorNode.getParent();
    return parent === topLevel && anchorNode.getIndexWithinParent() === 0;
  }

  if ($isElementNode(anchorNode) && anchor.offset === 0) {
    return anchorNode.getTopLevelElement() === topLevel;
  }

  return false;
}

function $isCaretAtTopLevelEnd(
  selection: RangeSelection,
  topLevel: ElementNode,
): boolean {
  const anchor = selection.anchor;
  const anchorNode = anchor.getNode();

  if (anchorNode === topLevel && anchor.type === 'element') {
    return anchor.offset === topLevel.getChildrenSize();
  }

  if ($isTextNode(anchorNode)) {
    return (
      anchor.offset === anchorNode.getTextContentSize() &&
      anchorNode.getParent() === topLevel &&
      anchorNode.getIndexWithinParent() === topLevel.getChildrenSize() - 1
    );
  }

  return false;
}
