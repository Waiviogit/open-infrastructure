'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findCellNode, $findTableNode, $getTableRowIndexFromTableCellNode } from '@lexical/table';
import {
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  RootNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { useEffect } from 'react';

import {
  $blockKind,
  $ensureTrailingTextLine,
  $leaveBlockAtEdge,
  $openLineBeside,
  type BlockSide,
} from '../../application/block-gaps';
import { $isMediaBlockNode } from '../../domain/nodes/media-block';

/** A single character key without command modifiers (Shift is fine). */
function isPrintableKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/** How close (in line heights) the caret must be to the block edge to count as "on the edge line". */
const EDGE_LINE_TOLERANCE = 1.2;
const FALLBACK_LINE_HEIGHT_PX = 22;

/** True when the DOM caret sits on the first (`before`) / last (`after`) text line of `element`. */
function caretOnEdgeLine(element: HTMLElement, side: BlockSide): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return true;
  }
  const caret = selection.getRangeAt(0).getBoundingClientRect();
  if (caret.height === 0) {
    return true;
  }
  const style = getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight) || FALLBACK_LINE_HEIGHT_PX;
  const box = element.getBoundingClientRect();
  const tolerance = lineHeight * EDGE_LINE_TOLERANCE;
  return side === 'before'
    ? caret.top - box.top - (Number.parseFloat(style.paddingTop) || 0) < tolerance
    : box.bottom - caret.bottom - (Number.parseFloat(style.paddingBottom) || 0) < tolerance;
}

/**
 * Top-level block the caret is leaving, or `null` when the caret is not on the
 * block's edge line (tables: edge row and the cell's edge line).
 */
function $blockAtCaretEdge(editor: LexicalEditor, side: BlockSide): LexicalNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor.getNode();
  const cell = $findCellNode(anchor);
  if (cell) {
    const table = $findTableNode(cell);
    const edgeRow = side === 'before' ? 0 : (table?.getChildrenSize() ?? 1) - 1;
    const cellElement = editor.getElementByKey(cell.getKey());
    if (!table || $getTableRowIndexFromTableCellNode(cell) !== edgeRow || !cellElement) {
      return null;
    }
    return caretOnEdgeLine(cellElement, side) ? table : null;
  }
  const block = anchor.getKey() === 'root' ? null : anchor.getTopLevelElement();
  const element = block ? editor.getElementByKey(block.getKey()) : null;
  return block && element && caretOnEdgeLine(element, side) ? block : null;
}

function $handleArrow(editor: LexicalEditor, event: KeyboardEvent | null, side: BlockSide): boolean {
  const selection = $getSelection();
  let block: LexicalNode | null = null;
  if ($isNodeSelection(selection)) {
    const [node] = selection.getNodes();
    block = $isMediaBlockNode(node) ? node : null;
  } else {
    block = $blockAtCaretEdge(editor, side);
  }
  if (!block || $blockKind(block) === null || !$leaveBlockAtEdge(block, side)) {
    return false;
  }
  event?.preventDefault();
  return true;
}

/**
 * Keeps the caret from getting stuck around tables, code, images, videos and
 * lines: the document always ends with a text line (also right after a draft
 * loads), arrows select / step over media blocks and leave tables and code
 * blocks, and Enter or typing on a selected media block opens a line below it.
 */
export function EditorBlockGapsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removers = [
      editor.registerNodeTransform(RootNode, $ensureTrailingTextLine),
      // `setEditorState` (draft load, edit mode) skips transforms.
      editor.registerUpdateListener(({ editorState }) => {
        const needsLine = editorState.read(() => $blockKind($getRoot().getLastChild()) !== 'flow');
        if (needsLine) {
          editor.update(() => $ensureTrailingTextLine($getRoot()), { tag: 'history-merge' });
        }
      }),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => $handleArrow(editor, event, 'before'),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => $handleArrow(editor, event, 'after'),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            return false;
          }
          const [node] = selection.getNodes();
          if (!$isMediaBlockNode(node)) {
            return false;
          }
          $openLineBeside(node, 'after');
          event?.preventDefault();
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      // Typing while an image / video / line is selected starts a new line below it.
      // (The browser would otherwise type at its stale DOM caret.)
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (!isPrintableKey(event)) {
            return false;
          }
          const selection = $getSelection();
          if (!$isNodeSelection(selection)) {
            return false;
          }
          const [node] = selection.getNodes();
          if (!$isMediaBlockNode(node)) {
            return false;
          }
          event.preventDefault();
          $openLineBeside(node, 'after');
          const caret = $getSelection();
          if ($isRangeSelection(caret)) {
            caret.insertText(event.key);
          }
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    ];
    return () => {
      for (const remove of removers) {
        remove();
      }
    };
  }, [editor]);

  return null;
}
