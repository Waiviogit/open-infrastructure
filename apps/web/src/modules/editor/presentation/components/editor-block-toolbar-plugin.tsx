'use client';

import { $isCodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findTableNode, $isTableNode, $isTableSelection, type TableNode } from '@lexical/table';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  type LexicalNode,
  type NodeKey,
} from 'lexical';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { TrashIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';

import { $openLineBeside, type BlockSide } from '../../application/block-gaps';
import { $removeMediaBlocksAndPlaceCaret } from '../../application/image-selection';
import { $appendTableColumn, $appendTableRow, $removeTable } from '../../application/table-actions';
import { $isMediaBlockNode } from '../../domain/nodes/media-block';

/** Gap between the toolbar and the block edge. */
const TOOLBAR_GAP_PX = 6;
/** Toolbar height before it is measured (`h-8` buttons + `p-1`). */
const TOOLBAR_FALLBACK_HEIGHT_PX = 40;
const VIEWPORT_MARGIN_PX = 8;
/** Below this viewport y the toolbar would sit under the fixed site header → place it under the block. */
const MIN_TOOLBAR_TOP_PX = 64;

type ActiveBlock = { key: NodeKey; kind: 'table' | 'code' | 'media' };

type ToolbarPosition = { top: number; left: number };

const BUTTON_CLASS =
  'flex h-8 shrink-0 items-center rounded-btn px-2 text-body-sm font-weight-label text-fg transition-colors hover:bg-ghost-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5';

/** Block the toolbar is for: a node-selected image / video / line, or the table / code block holding the caret. */
function $activeBlock(): ActiveBlock | null {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const [node] = selection.getNodes();
    return $isMediaBlockNode(node) ? { key: node.getKey(), kind: 'media' } : null;
  }
  if (!$isRangeSelection(selection) && !$isTableSelection(selection)) {
    return null;
  }
  const anchor = selection.anchor.getNode();
  const table = $findTableNode(anchor);
  if (table) {
    return { key: table.getKey(), kind: 'table' };
  }
  const top = anchor.getKey() === 'root' ? null : anchor.getTopLevelElement();
  return $isCodeNode(top) ? { key: top.getKey(), kind: 'code' } : null;
}

/**
 * Floating actions for the active non-text block. Every block gets "↑ Line" /
 * "↓ Line" (the touch way out of a table, code, image, video or line — there
 * are no arrow keys on phones); tables keep the legacy +Row / +Column / Remove
 * table; images, videos and lines get Remove.
 */
export function EditorBlockToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const [active, setActive] = useState<ActiveBlock | null>(null);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read($activeBlock);
        setActive((prev) => (prev?.key === next?.key && prev?.kind === next?.kind ? prev : next));
      }),
    [editor],
  );

  const measure = useCallback(() => {
    const blockEl = active ? editor.getElementByKey(active.key) : null;
    if (!blockEl) {
      setPosition(null);
      return;
    }
    const rect = blockEl.getBoundingClientRect();
    const height = toolbarEl?.offsetHeight ?? TOOLBAR_FALLBACK_HEIGHT_PX;
    const width = toolbarEl?.offsetWidth ?? 0;
    const above = rect.top - height - TOOLBAR_GAP_PX;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
    setPosition({
      top: above >= MIN_TOOLBAR_TOP_PX ? above : rect.bottom + TOOLBAR_GAP_PX,
      left: Math.max(VIEWPORT_MARGIN_PX, Math.min(rect.left, maxLeft)),
    });
  }, [active, editor, toolbarEl]);

  useLayoutEffect(() => {
    measure();
    if (!active) {
      return;
    }
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const unregister = editor.registerUpdateListener(() => measure());
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      unregister();
    };
  }, [active, editor, measure]);

  // Width is known only after the buttons render (and changes per block kind): re-clamp then.
  useEffect(() => {
    if (!toolbarEl) {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(toolbarEl);
    return () => observer.disconnect();
  }, [measure, toolbarEl]);

  const runOnBlock = useCallback(
    (action: (block: LexicalNode) => void) => {
      if (!active) {
        return;
      }
      editor.update(() => {
        const block = $getNodeByKey(active.key);
        if (block) {
          action(block);
        }
      });
      editor.focus();
    },
    [active, editor],
  );

  const runOnTable = (action: (table: TableNode) => void) =>
    runOnBlock((block) => {
      if ($isTableNode(block)) {
        action(block);
      }
    });

  const openLine = (side: BlockSide) => runOnBlock((block) => $openLineBeside(block, side));

  if (!active || !position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={setToolbarEl}
      role="toolbar"
      aria-label={t('editor_block_toolbar_aria')}
      className="fixed z-[100] flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-btn border border-border bg-surface p-1 shadow-card"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {active.kind === 'table' ? (
        <>
          <button type="button" className={BUTTON_CLASS} onClick={() => runOnTable($appendTableRow)}>
            {t('editor_table_add_row')}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => runOnTable($appendTableColumn)}>
            {t('editor_table_add_column')}
          </button>
          <button
            type="button"
            className={BUTTON_CLASS}
            aria-label={t('editor_table_remove')}
            title={t('editor_table_remove')}
            onClick={() => runOnTable($removeTable)}
          >
            <TrashIcon size={16} />
          </button>
        </>
      ) : null}
      <button type="button" className={BUTTON_CLASS} onClick={() => openLine('before')}>
        {t('editor_block_line_above')}
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={() => openLine('after')}>
        {t('editor_block_line_below')}
      </button>
      {active.kind === 'media' ? (
        <button
          type="button"
          className={BUTTON_CLASS}
          aria-label={t('editor_block_remove')}
          title={t('editor_block_remove')}
          onClick={() =>
            runOnBlock((block) => {
              if ($isMediaBlockNode(block)) {
                $removeMediaBlocksAndPlaceCaret([block]);
              }
            })
          }
        >
          <TrashIcon size={16} />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
