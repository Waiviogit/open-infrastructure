'use client';

import { $isLinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { BoldIcon, ItalicIcon, LinkIcon, MoreHorizontalIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';

import {
  applyFormatAction,
  getSelectedBlockType,
  registerSpoilerCommand,
  selectionHasSpoiler,
  type SelectedBlockType,
} from '../../application/apply-format-action';
import { MORE_ACTIONS, type FormatActionId } from '../../domain/format-actions';
import { normalizeTextLinkUrl } from '../../domain/link-url';

const TOOLBAR_GAP_PX = 8;
const VIEWPORT_EDGE_PX = 8;
const TOOLBAR_FALLBACK_HEIGHT_PX = 40;
const TOOLBAR_FALLBACK_WIDTH_PX = 200;
/** CSS Custom Highlight name; styled by `::highlight(editor-link-target)` in `global.css`. */
const LINK_TARGET_HIGHLIGHT = 'editor-link-target';

type ToolbarPosition = {
  top: number;
  left: number;
};

/** Text the URL input will link: kept while focus is in the input and the editor has no selection. */
type LinkTarget = {
  selection: RangeSelection;
  range: Range;
};

/** Keeps Lexical selection on toolbar buttons; allows focus in URL input. */
function preventToolbarMouseDown(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    event.preventDefault();
    return;
  }
  if (target.closest('input, textarea')) {
    return;
  }
  event.preventDefault();
}

function getEditorDomRange(root: HTMLElement | null): Range | null {
  if (!root) {
    return null;
  }
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) {
    return null;
  }
  const range = domSelection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }
  return range;
}

function getVisibleRect(range: Range | null): DOMRect | null {
  const rect = range?.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    return null;
  }
  return rect;
}

function supportsCssHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

/** Paints the link target while the URL input owns the DOM selection (progressive enhancement). */
function showLinkTargetHighlight(range: Range): void {
  if (supportsCssHighlights()) {
    CSS.highlights.set(LINK_TARGET_HIGHLIGHT, new Highlight(range));
  }
}

function clearLinkTargetHighlight(): void {
  if (supportsCssHighlights()) {
    CSS.highlights.delete(LINK_TARGET_HIGHLIGHT);
  }
}

function readTextSelection(editor: LexicalEditor): RangeSelection | null {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      return null;
    }
    return selection.clone();
  });
}

/** Puts the saved selection back into the editor, unless its nodes were removed meanwhile. */
function restoreEditorSelection(editor: LexicalEditor, selection: RangeSelection): void {
  editor.update(() => {
    if (!$getNodeByKey(selection.anchor.key) || !$getNodeByKey(selection.focus.key)) {
      return;
    }
    $setSelection(selection.clone());
  });
  editor.focus();
}

function selectionIsLink(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }
  for (const node of selection.getNodes()) {
    let current: LexicalNode | null = node;
    while (current !== null) {
      if ($isLinkNode(current)) {
        return true;
      }
      current = current.getParent();
    }
  }
  return false;
}

function toolbarBtnClass(active: boolean): string {
  return [
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-fg transition-colors',
    'hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-accent text-accent-fg' : '',
  ].join(' ');
}

function isBlockActive(blockType: SelectedBlockType, actionId: FormatActionId): boolean {
  if (actionId === 'quote') {
    return blockType === 'quote';
  }
  if (actionId === 'h1' || actionId === 'h2' || actionId === 'h3') {
    return blockType === actionId;
  }
  return false;
}

export function EditorFormatToolbar() {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const toolbarId = useId();
  const moreMenuId = useId();
  const linkErrorId = useId();

  const [portalReady, setPortalReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<SelectedBlockType>('paragraph');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState(false);
  /**
   * Set while the URL input is open. A ref (not state) so DOM/Lexical listeners and rAF callbacks
   * never read a stale value from an older render.
   */
  const linkTargetRef = useRef<LinkTarget | null>(null);

  const placeToolbar = useCallback((anchorRect: DOMRect) => {
    const toolbarEl = toolbarRef.current;
    const toolbarHeight = toolbarEl?.offsetHeight ?? TOOLBAR_FALLBACK_HEIGHT_PX;
    const toolbarWidth = toolbarEl?.offsetWidth ?? TOOLBAR_FALLBACK_WIDTH_PX;
    const centerX = anchorRect.left + anchorRect.width / 2;
    const clampedLeft = Math.max(
      VIEWPORT_EDGE_PX + toolbarWidth / 2,
      Math.min(window.innerWidth - VIEWPORT_EDGE_PX - toolbarWidth / 2, centerX),
    );
    const top = Math.max(VIEWPORT_EDGE_PX, anchorRect.top - toolbarHeight - TOOLBAR_GAP_PX);
    setPosition({ top, left: clampedLeft });
  }, []);

  const syncToolbar = useCallback(() => {
    const linkTarget = linkTargetRef.current;
    if (linkTarget) {
      // Focus is in the URL input: stay anchored to the saved text, not the (empty) DOM selection.
      const targetRect = getVisibleRect(linkTarget.range);
      if (targetRect) {
        placeToolbar(targetRect);
      }
      return;
    }

    const rect = getVisibleRect(getEditorDomRange(editor.getRootElement()));
    const hasTextSelection = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        return false;
      }
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsCode(selection.hasFormat('code'));
      setIsLink(selectionIsLink());
      setBlockType(getSelectedBlockType());
      setHasSpoiler(selectionHasSpoiler());
      return true;
    });

    if (!hasTextSelection || !rect) {
      setVisible(false);
      setMoreOpen(false);
      return;
    }
    placeToolbar(rect);
    setVisible(true);
  }, [editor, placeToolbar]);

  const exitLinkMode = useCallback(() => {
    linkTargetRef.current = null;
    clearLinkTargetHighlight();
    setLinkMode(false);
    setLinkUrl('');
    setLinkError(false);
  }, []);

  useEffect(() => {
    setPortalReady(true);
    return clearLinkTargetHighlight;
  }, []);

  useEffect(() => {
    return registerSpoilerCommand(editor);
  }, [editor]);

  useLayoutEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        syncToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, syncToolbar]);

  useEffect(() => {
    const root = editor.getRootElement();
    const onActivity = () => syncToolbar();
    document.addEventListener('selectionchange', onActivity);
    root?.addEventListener('scroll', onActivity);
    window.addEventListener('resize', onActivity);
    return () => {
      document.removeEventListener('selectionchange', onActivity);
      root?.removeEventListener('scroll', onActivity);
      window.removeEventListener('resize', onActivity);
    };
  }, [editor, syncToolbar]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        toolbarRef.current?.contains(target) ||
        moreMenuRef.current?.contains(target)
      ) {
        return;
      }
      setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

  /** A click outside the toolbar (e.g. a new selection in the editor) drops the pending link. */
  useEffect(() => {
    if (!linkMode) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (toolbarRef.current?.contains(event.target as Node)) {
        return;
      }
      exitLinkMode();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [exitLinkMode, linkMode]);

  useLayoutEffect(() => {
    if (!linkMode) {
      return;
    }
    const input = linkInputRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    input.select();
  }, [linkMode]);

  const runAction = useCallback(
    (actionId: FormatActionId) => {
      applyFormatAction(editor, actionId);
      setMoreOpen(false);
      requestAnimationFrame(() => syncToolbar());
    },
    [editor, syncToolbar],
  );

  const openLinkMode = useCallback(() => {
    const domRange = getEditorDomRange(editor.getRootElement());
    const selection = readTextSelection(editor);
    if (!domRange || !selection) {
      return;
    }
    const range = domRange.cloneRange();
    linkTargetRef.current = { selection, range };
    showLinkTargetHighlight(range);
    setLinkMode(true);
    setLinkUrl('');
    setMoreOpen(false);
    // Re-center once the wider URL form has rendered.
    requestAnimationFrame(() => syncToolbar());
  }, [editor, syncToolbar]);

  /** Escape / empty Apply: back to the editor with the same text still selected. */
  const cancelLinkMode = useCallback(() => {
    const target = linkTargetRef.current;
    exitLinkMode();
    if (target) {
      restoreEditorSelection(editor, target.selection);
    }
  }, [editor, exitLinkMode]);

  /** Bare domains get `https://` (a relative href would open on our own host); invalid input keeps the form open. */
  const submitLink = useCallback(() => {
    const target = linkTargetRef.current;
    if (!linkUrl.trim() || !target) {
      cancelLinkMode();
      return;
    }
    const url = normalizeTextLinkUrl(linkUrl);
    if (!url) {
      setLinkError(true);
      linkInputRef.current?.focus({ preventScroll: true });
      return;
    }
    exitLinkMode();
    restoreEditorSelection(editor, target.selection);
    applyFormatAction(editor, 'link', { linkUrl: url });
  }, [cancelLinkMode, editor, exitLinkMode, linkUrl]);

  const showToolbar = visible || linkMode;
  if (!portalReady || !showToolbar || !position) {
    return null;
  }

  const comingSoon = t('app_header_coming_soon');

  const toolbar = (
    <div
      ref={toolbarRef}
      id={toolbarId}
      role="toolbar"
      aria-label={t('editor_format_toolbar_aria')}
      className="fixed z-[100] flex items-center gap-0.5 rounded-btn border border-border bg-surface p-1 shadow-card"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={preventToolbarMouseDown}
    >
      {linkMode ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-0.5">
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError(false);
              }}
              placeholder={t('editor_format_link_url')}
              aria-invalid={linkError}
              aria-describedby={linkError ? linkErrorId : undefined}
              className={[
                'h-8 min-w-[12rem] max-w-[20rem] rounded-btn border bg-bg px-2 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring',
                linkError ? 'border-error' : 'border-border',
              ].join(' ')}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitLink();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelLinkMode();
                }
              }}
            />
            <button
              type="button"
              className="h-8 shrink-0 rounded-btn bg-accent px-3 text-body-sm font-weight-label text-accent-fg hover:opacity-90"
              onClick={submitLink}
            >
              {t('editor_format_link_apply')}
            </button>
          </div>
          {linkError ? (
            <p id={linkErrorId} role="alert" className="max-w-[20rem] px-1 text-caption text-error">
              {t('editor_format_link_invalid')}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <button
            type="button"
            className={toolbarBtnClass(isBold)}
            aria-label={t('editor_format_bold')}
            aria-pressed={isBold}
            onClick={() => runAction('bold')}
          >
            <BoldIcon size={18} />
          </button>
          <button
            type="button"
            className={toolbarBtnClass(isItalic)}
            aria-label={t('editor_format_italic')}
            aria-pressed={isItalic}
            onClick={() => runAction('italic')}
          >
            <ItalicIcon size={18} />
          </button>
          <button
            type="button"
            className={toolbarBtnClass(isLink)}
            aria-label={t('editor_format_link')}
            aria-pressed={isLink}
            onClick={openLinkMode}
          >
            <LinkIcon size={18} />
          </button>
          <div className="relative">
            <button
              type="button"
              className={toolbarBtnClass(moreOpen)}
              aria-label={t('editor_format_more')}
              aria-expanded={moreOpen}
              aria-controls={moreMenuId}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontalIcon size={18} />
            </button>
            {moreOpen ? (
              <div
                ref={moreMenuRef}
                id={moreMenuId}
                role="menu"
                className="absolute start-0 top-full z-[101] mt-1 min-w-[10rem] rounded-btn border border-border bg-surface py-1 shadow-card"
              >
                {MORE_ACTIONS.map((action) => {
                  const active =
                    action.id === 'spoiler'
                      ? hasSpoiler
                      : action.id === 'code'
                        ? isCode
                        : isBlockActive(blockType, action.id);
                  const isMentionStub = action.id === 'mention';
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      disabled={isMentionStub}
                      title={isMentionStub ? comingSoon : undefined}
                      className={[
                        'flex w-full items-center px-3 py-1.5 text-start text-body text-fg',
                        'hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50',
                        active ? 'text-accent' : '',
                      ].join(' ')}
                      aria-pressed={active}
                      onClick={() => {
                        if (!isMentionStub) {
                          runAction(action.id);
                        }
                      }}
                    >
                      {t(action.labelKey)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  return createPortal(toolbar, document.body);
}
