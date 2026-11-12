'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import {
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  type BaseSelection,
  type LexicalEditor,
} from 'lexical';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  CloseIcon,
  CalendarIcon,
  CodeIcon,
  EmojiIcon,
  ImageIcon,
  LayoutGridIcon,
  MinusIcon,
  PlusIcon,
  TableIcon,
  VideoIcon,
} from '@/icons';
import type { IconProps } from '@/icons';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { MODAL_Z_INDEX_EDITOR_OVERLAY } from '@/shared/presentation';

import {
  $convertCaretBlockToCode,
  $insertHorizontalRuleAtCaret,
} from '../../application/insert-editor-blocks';
import { INSERT_TABLE_DEFAULT_SIZE } from '../../application/table-actions';
import { insertObjectLinkAtSelection } from '../../application/insert-editor-object-link';
import { EditorInlineObjectSearch } from './editor-inline-object-search';
import { EditorInsertEmojiPanel } from './editor-insert-emoji-panel';
import { EditorInsertPhotoPanel } from './editor-insert-photo-panel';
import { EditorInlineVideoInput } from './editor-inline-video-input';

const INSERT_BTN_SIZE_PX = 40;
/** Panel is centered on (+); keep it this far from the viewport edges. */
const INSERT_PANEL_VIEWPORT_MARGIN_PX = 8;
/** Fallback half-width before the panel is measured (`w-[min(100vw-2rem,20rem)]`). */
const INSERT_PANEL_FALLBACK_HALF_WIDTH_PX = 160;

/** Horizontal center for the panel so the whole panel stays inside the viewport. */
function clampInsertPanelCenterX(centerX: number, panelWidth: number | undefined): number {
  const half = panelWidth ? panelWidth / 2 : INSERT_PANEL_FALLBACK_HALF_WIDTH_PX;
  const min = half + INSERT_PANEL_VIEWPORT_MARGIN_PX;
  const max = window.innerWidth - half - INSERT_PANEL_VIEWPORT_MARGIN_PX;
  return max < min ? window.innerWidth / 2 : Math.min(max, Math.max(min, centerX));
}
const INSERT_BTN_RADIUS = INSERT_BTN_SIZE_PX / 2;

type InsertLabelKey =
  | 'editor_insert_photo'
  | 'editor_insert_video'
  | 'editor_insert_object'
  | 'editor_insert_date'
  | 'editor_insert_line'
  | 'editor_insert_code'
  | 'editor_insert_table'
  | 'editor_insert_emoji';

const INSERT_ITEMS: {
  labelKey: InsertLabelKey;
  Icon: (props: IconProps) => React.JSX.Element | null;
}[] = [
  { labelKey: 'editor_insert_photo', Icon: ImageIcon },
  { labelKey: 'editor_insert_video', Icon: VideoIcon },
  { labelKey: 'editor_insert_object', Icon: LayoutGridIcon },
  { labelKey: 'editor_insert_date', Icon: CalendarIcon },
  { labelKey: 'editor_insert_line', Icon: MinusIcon },
  { labelKey: 'editor_insert_code', Icon: CodeIcon },
  { labelKey: 'editor_insert_table', Icon: TableIcon },
  { labelKey: 'editor_insert_emoji', Icon: EmojiIcon },
];

function getRangeForCaret(editorRoot: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (editorRoot.contains(r.commonAncestorContainer)) {
      return r;
    }
  }
  const firstBlock = editorRoot.querySelector('p, h1, h2, h3, h4, h5, h6');
  if (firstBlock && editorRoot.contains(firstBlock)) {
    const r = document.createRange();
    try {
      r.selectNodeContents(firstBlock);
      r.collapse(true);
      return r;
    } catch {
      return null;
    }
  }
  const r = document.createRange();
  try {
    r.selectNodeContents(editorRoot);
    r.collapse(true);
    return r;
  } catch {
    return null;
  }
}

/**
 * Collapsed DOM ranges in contenteditable often yield empty `getClientRects()` and
 * zero-height `getBoundingClientRect()`. Expand a clone by one character or use
 * a BR block rect so the + button can track the active line.
 */
function getCaretLineViewportRect(
  range: Range,
  editorRoot: HTMLElement,
): { top: number; height: number } | null {
  const rects = range.getClientRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.height > 0.5) {
      return { top: r.top, height: r.height };
    }
  }

  let br = range.getBoundingClientRect();
  if (br.height > 0.5) {
    return { top: br.top, height: br.height };
  }

  const clone = range.cloneRange();
  if (!clone.collapsed) {
    br = clone.getBoundingClientRect();
    return br.height > 0.5 ? { top: br.top, height: br.height } : null;
  }

  const node = clone.startContainer;
  const offset = clone.startOffset;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (offset < text.length) {
      clone.setEnd(node, offset + 1);
      br = clone.getBoundingClientRect();
      if (br.height > 0) {
        return { top: br.top, height: br.height };
      }
    }
    if (offset > 0) {
      const c2 = range.cloneRange();
      c2.setStart(node, offset - 1);
      c2.setEnd(node, offset);
      br = c2.getBoundingClientRect();
      if (br.height > 0) {
        return { top: br.top, height: br.height };
      }
    }
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (offset < el.childNodes.length) {
      const child = el.childNodes[offset];
      if (child.nodeName === 'BR') {
        const lineEl = el as HTMLElement;
        const lh =
          Number.parseFloat(getComputedStyle(lineEl).lineHeight) ||
          Number.parseFloat(getComputedStyle(lineEl).fontSize) * 1.25 ||
          22;
        const r = (child as HTMLBRElement).getBoundingClientRect();
        return { top: r.top, height: Math.max(r.height || lh * 0.8, lh * 0.85) };
      }
      if (child.nodeType === Node.TEXT_NODE && child.textContent) {
        const c3 = range.cloneRange();
        c3.setStart(child, 0);
        c3.setEnd(child, 1);
        br = c3.getBoundingClientRect();
        if (br.height > 0) {
          return { top: br.top, height: br.height };
        }
      }
    }
  }

  let block: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  while (block && block !== editorRoot) {
    const display = getComputedStyle(block).display;
    if (display === 'block' || display === 'list-item' || block.tagName === 'LI') {
      break;
    }
    block = block.parentElement;
  }
  if (block && editorRoot.contains(block)) {
    return blockFirstLineRect(block);
  }

  const lh = Number.parseFloat(getComputedStyle(editorRoot).lineHeight) || 22;
  br = range.getBoundingClientRect();
  if (br.top > 0 || br.left > 0) {
    return { top: br.top, height: lh };
  }
  return null;
}

/** First text line of a block: its top plus padding (empty code blocks are padded). */
function blockFirstLineRect(block: HTMLElement): { top: number; height: number } {
  const style = getComputedStyle(block);
  const lh =
    Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.25 || 22;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  return { top: block.getBoundingClientRect().top + paddingTop, height: lh };
}

/**
 * The line the (+) should follow, from Lexical's selection: a node-selected
 * block (image, video, line) → that block; otherwise the DOM caret. The DOM
 * selection is stale while a block is node-selected, so it cannot be used then.
 */
function getActiveLineViewportRect(
  editor: LexicalEditor,
  root: HTMLElement,
): { top: number; height: number } | null {
  const selectedBlock = editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isNodeSelection(selection)) {
      return null;
    }
    const node = selection.getNodes()[0];
    return node ? editor.getElementByKey(node.getKey()) : null;
  });
  if (selectedBlock) {
    const rect = selectedBlock.getBoundingClientRect();
    return { top: rect.top, height: rect.height };
  }
  const range = getRangeForCaret(root);
  return range ? getCaretLineViewportRect(range, root) : null;
}

function scheduleMeasure(fn: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function computeInsertOverlayTop(
  editor: LexicalEditor,
  container: HTMLElement,
): number | null {
  const root = editor.getRootElement();
  if (!root) {
    return null;
  }

  const line = getActiveLineViewportRect(editor, root);
  if (!line) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const centerY = line.top + line.height / 2;
  const topPx = centerY - containerRect.top - INSERT_BTN_RADIUS;
  const maxTop = container.clientHeight - INSERT_BTN_SIZE_PX - 8;
  return Math.max(8, Math.min(maxTop, topPx));
}

export type EditorInsertCaretOverlayProps = {
  /** Single-line bar (e.g. comment): pin (+) to vertical center instead of caret line. */
  pinInsertCenterVertical?: boolean;
  /** When user picks an object from inline search (Insert → Object). */
  onObjectLinkedFromEditor?: (result: SearchObjectResult) => void;
  /** Object activity: show Date insert item and original publish picker. */
  enableOriginalCreatedAt?: boolean;
  /** Object activity: open insert panel below (+) instead of above. */
  insertPanelPreferBelow?: boolean;
  /** Renders inline date+time picker when Insert → Date is opened (object activity). */
  renderOriginalDatePicker?: (props: { onSelect: (unix: number) => void }) => ReactNode;
  /** Fired when user picks an original publish date+time (unix seconds). */
  onOriginalCreatedAtSelected?: (unix: number) => void;
};

/**
 * Positions the insert control on the left edge (straddling the border) and
 * vertically aligned with the current caret / active line.
 */
export function EditorInsertCaretOverlay({
  pinInsertCenterVertical = false,
  onObjectLinkedFromEditor,
  enableOriginalCreatedAt = false,
  insertPanelPreferBelow = false,
  renderOriginalDatePicker,
  onOriginalCreatedAtSelected,
}: EditorInsertCaretOverlayProps = {}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  /** Inline field at the caret line instead of the (+) panel: object search or video link. */
  const [inlineMode, setInlineMode] = useState<'object' | 'video' | null>(null);
  const inlineInputOpen = inlineMode !== null;
  const [insertView, setInsertView] = useState<
    'grid' | 'photo' | 'date' | 'emoji'
  >('grid');
  const [buttonTop, setButtonTop] = useState(12);
  const [insertPanelCoords, setInsertPanelCoords] = useState<{
    top: number;
    left: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLDivElement>(null);
  const insertButtonRef = useRef<HTMLButtonElement>(null);
  const insertPanelRef = useRef<HTMLDivElement>(null);
  const insertTitleId = useId();
  const insertPanelId = useId();
  const savedSelectionRef = useRef<BaseSelection | null>(null);

  const handleObjectSelect = useCallback(
    (result: SearchObjectResult) => {
      const saved = savedSelectionRef.current;
      if (saved) {
        editor.update(() => {
          $setSelection(saved);
        });
      }
      insertObjectLinkAtSelection(editor, result);
      onObjectLinkedFromEditor?.(result);
      savedSelectionRef.current = null;
      setInlineMode(null);
    },
    [editor, onObjectLinkedFromEditor],
  );

  const closeInsertPanel = useCallback(() => {
    setOpen(false);
    setInsertView('grid');
  }, []);

  const restoreSavedSelection = useCallback(() => {
    const saved = savedSelectionRef.current;
    if (saved) {
      editor.update(() => {
        $setSelection(saved.clone());
      });
    }
  }, [editor]);

  const insertHorizontalRule = useCallback(() => {
    closeInsertPanel();
    editor.focus();
    editor.update($insertHorizontalRuleAtCaret);
  }, [closeInsertPanel, editor]);

  const insertCodeBlock = useCallback(() => {
    closeInsertPanel();
    editor.focus();
    editor.update($convertCaretBlockToCode);
  }, [closeInsertPanel, editor]);

  const insertTable = useCallback(() => {
    closeInsertPanel();
    editor.focus();
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: INSERT_TABLE_DEFAULT_SIZE,
      columns: INSERT_TABLE_DEFAULT_SIZE,
      includeHeaders: { rows: true, columns: false },
    });
  }, [closeInsertPanel, editor]);

  const openEmojiPanel = useCallback(() => {
    editor.getEditorState().read(() => {
      const sel = $getSelection();
      savedSelectionRef.current = $isRangeSelection(sel) ? sel.clone() : null;
    });
    setInsertView('emoji');
  }, [editor]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      closeInsertPanel();
      editor.focus();
      restoreSavedSelection();
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(emoji);
        }
      });
      savedSelectionRef.current = null;
    },
    [closeInsertPanel, editor, restoreSavedSelection],
  );

  const openInlineInput = useCallback((mode: 'object' | 'video') => {
    editor.getEditorState().read(() => {
      const sel = $getSelection();
      savedSelectionRef.current =
        $isRangeSelection(sel) ? sel.clone() : null;
    });
    const container = containerRef.current;
    if (container && !pinInsertCenterVertical) {
      const top = computeInsertOverlayTop(editor, container);
      if (top !== null) {
        setButtonTop(top);
      }
    }
    setOpen(false);
    setInsertView('grid');
    setInlineMode(mode);
  }, [editor, pinInsertCenterVertical]);

  const measurePosition = useCallback(() => {
    if (pinInsertCenterVertical || inlineInputOpen) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const top = computeInsertOverlayTop(editor, container);
    setButtonTop(top ?? 12);
  }, [editor, inlineInputOpen, pinInsertCenterVertical]);

  useLayoutEffect(() => {
    if (pinInsertCenterVertical) {
      return;
    }
    scheduleMeasure(measurePosition);
    return editor.registerUpdateListener(() => {
      scheduleMeasure(measurePosition);
    });
  }, [editor, measurePosition, pinInsertCenterVertical]);

  useEffect(() => {
    if (pinInsertCenterVertical) {
      return;
    }
    const onSel = () => scheduleMeasure(measurePosition);
    document.addEventListener('selectionchange', onSel);
    const root = editor.getRootElement();
    const onRootActivity = () => scheduleMeasure(measurePosition);
    root?.addEventListener('scroll', measurePosition);
    root?.addEventListener('keyup', onRootActivity);
    root?.addEventListener('input', onRootActivity);
    root?.addEventListener('click', onRootActivity);
    window.addEventListener('resize', measurePosition);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      root?.removeEventListener('scroll', measurePosition);
      root?.removeEventListener('keyup', onRootActivity);
      root?.removeEventListener('input', onRootActivity);
      root?.removeEventListener('click', onRootActivity);
      window.removeEventListener('resize', measurePosition);
    };
  }, [editor, measurePosition, pinInsertCenterVertical]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updateInsertPanelCoords = useCallback(() => {
    const btn = insertButtonRef.current;
    if (!btn) {
      setInsertPanelCoords(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    const panelHeight = insertPanelRef.current?.offsetHeight ?? 240;
    const left = clampInsertPanelCenterX(
      r.left + r.width / 2,
      insertPanelRef.current?.offsetWidth,
    );
    const gap = 8;

    if (insertPanelPreferBelow) {
      const top = Math.min(
        r.bottom + gap,
        Math.max(gap, window.innerHeight - panelHeight - gap),
      );
      setInsertPanelCoords({
        top,
        left,
        placement: 'below',
      });
      return;
    }

    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const openAbove =
      !insertPanelPreferBelow &&
      (pinInsertCenterVertical ||
        (spaceBelow < panelHeight && spaceAbove > spaceBelow));

    setInsertPanelCoords({
      top: openAbove ? r.top - gap : r.bottom + gap,
      left,
      placement: openAbove ? 'above' : 'below',
    });
  }, [insertPanelPreferBelow, pinInsertCenterVertical]);

  useLayoutEffect(() => {
    if (!open) {
      setInsertPanelCoords(null);
      return;
    }
    updateInsertPanelCoords();
    window.addEventListener('resize', updateInsertPanelCoords);
    window.addEventListener('scroll', updateInsertPanelCoords, true);
    return () => {
      window.removeEventListener('resize', updateInsertPanelCoords);
      window.removeEventListener('scroll', updateInsertPanelCoords, true);
    };
  }, [open, updateInsertPanelCoords]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateInsertPanelCoords();
  }, [insertView, open, updateInsertPanelCoords]);

  useEffect(() => {
    if (!inlineInputOpen) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        shellRef.current?.contains(target) ||
        inlineInputRef.current?.contains(target)
      ) {
        return;
      }
      if (target instanceof Element && target.closest('[role="listbox"]')) {
        return;
      }
      savedSelectionRef.current = null;
      setInlineMode(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        savedSelectionRef.current = null;
        setInlineMode(null);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [inlineInputOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (shellRef.current?.contains(target) || insertPanelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (inlineInputOpen) {
          savedSelectionRef.current = null;
          setInlineMode(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, inlineInputOpen]);

  const insertActions: Record<InsertLabelKey, () => void> = {
    editor_insert_photo: () => setInsertView('photo'),
    editor_insert_video: () => openInlineInput('video'),
    editor_insert_object: () => openInlineInput('object'),
    editor_insert_date: () => setInsertView('date'),
    editor_insert_line: insertHorizontalRule,
    editor_insert_code: insertCodeBlock,
    editor_insert_table: insertTable,
    editor_insert_emoji: openEmojiPanel,
  };

  return (
    <>
      <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[5] overflow-visible">
      <div
        ref={shellRef}
        className={[
          'pointer-events-auto absolute z-[70]',
          // Phones: the 16px page gutter is narrower than half the (+); keep it on screen.
          'start-0 -translate-x-[40%] sm:-translate-x-1/2',
          pinInsertCenterVertical ? 'top-1/2 -translate-y-1/2' : '',
        ].join(' ')}
        style={pinInsertCenterVertical ? undefined : { top: buttonTop }}
      >
        {inlineInputOpen ? (
          <button
            ref={insertButtonRef}
            type="button"
            aria-label={t('close')}
            title={t('close')}
            onClick={() => {
              savedSelectionRef.current = null;
              setInlineMode(null);
            }}
            className={[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-circle border border-border',
              'bg-bg text-fg-secondary shadow-none',
              'hover:bg-ghost-surface',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            ].join(' ')}
          >
            <CloseIcon size={18} />
          </button>
        ) : (
          <button
            ref={insertButtonRef}
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={open ? insertPanelId : undefined}
            aria-label={t('editor_insert_open_aria')}
            title={t('editor_insert_open_aria')}
            onClick={() => {
              setOpen((o) => {
                if (!o) {
                  setInsertView('grid');
                }
                return !o;
              });
            }}
            className={[
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-circle border border-border',
              'bg-bg text-fg-secondary shadow-none',
              'hover:bg-ghost-surface',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            ].join(' ')}
          >
            <PlusIcon size={20} />
          </button>
        )}
      </div>
      {inlineInputOpen ? (
        <div
          ref={inlineInputRef}
          className="pointer-events-auto absolute z-[70] flex items-center pe-3"
          style={{
            top: buttonTop,
            left: INSERT_BTN_RADIUS + 12,
            right: 0,
            height: INSERT_BTN_SIZE_PX,
          }}
        >
          {inlineMode === 'video' ? (
            <EditorInlineVideoInput
              restoreSelection={restoreSavedSelection}
              onInserted={() => {
                savedSelectionRef.current = null;
                setInlineMode(null);
              }}
            />
          ) : (
            <EditorInlineObjectSearch onSelect={handleObjectSelect} />
          )}
        </div>
      ) : null}
    </div>
    {portalReady &&
    open &&
    insertPanelCoords &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={insertPanelRef}
            id={insertPanelId}
            className={[
              'fixed w-[min(100vw-2rem,20rem)] -translate-x-1/2 rounded-card border border-border',
              'bg-surface p-3 shadow-card',
              insertPanelCoords.placement === 'above' ? '-translate-y-full' : '',
              insertPanelPreferBelow
                ? 'max-h-[min(70dvh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain'
                : '',
            ].join(' ')}
            style={{
              top: insertPanelCoords.top,
              left: insertPanelCoords.left,
              zIndex: MODAL_Z_INDEX_EDITOR_OVERLAY,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={insertTitleId}
          >
            <div className="mb-3 flex items-center gap-2">
              {insertView !== 'grid' ? (
                <button
                  type="button"
                  className="text-body-sm text-accent hover:underline"
                  onClick={() => setInsertView('grid')}
                >
                  {t('go_back')}
                </button>
              ) : null}
              <h2 id={insertTitleId} className="font-label text-body-sm text-heading">
                {insertView === 'photo'
                  ? t('editor_insert_photo')
                  : insertView === 'date'
                    ? t('editor_insert_date')
                    : insertView === 'emoji'
                        ? t('editor_insert_emoji')
                        : t('editor_insert_title')}
              </h2>
            </div>

            {insertView === 'emoji' ? (
              <EditorInsertEmojiPanel onSelect={insertEmoji} />
            ) : insertView === 'photo' ? (
              <EditorInsertPhotoPanel
                onInserted={() => {
                  setOpen(false);
                  setInsertView('grid');
                }}
              />
            ) : insertView === 'date' && renderOriginalDatePicker ? (
              renderOriginalDatePicker({
                onSelect: (unix) => {
                  onOriginalCreatedAtSelected?.(unix);
                },
              })
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {INSERT_ITEMS.map(({ labelKey, Icon }) => {
                  if (labelKey === 'editor_insert_date' && !enableOriginalCreatedAt) {
                    return null;
                  }
                  return (
                    <button
                      key={labelKey}
                      type="button"
                      className="flex flex-col items-center gap-1.5 rounded-btn bg-secondary px-2 py-3 text-body-sm text-secondary-fg hover:bg-surface-muted"
                      onClick={insertActions[labelKey]}
                    >
                      <Icon className="text-fg-secondary" size={22} />
                      <span className="text-center leading-compressed">
                        {t(labelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
