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
import { useCallback, useEffect, useLayoutEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

import { LinkIcon, PencilIcon, TrashIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { MODAL_Z_INDEX_EDITOR_OVERLAY } from '@/shared/presentation';

import { $openLineBeside, type BlockSide } from '../../application/block-gaps';
import { $removeMediaBlocksAndPlaceCaret } from '../../application/image-selection';
import { $appendTableColumn, $appendTableRow, $removeTable } from '../../application/table-actions';
import { IMAGE_ALT_TEXT_MAX_LENGTH, normalizeImageAltText } from '../../domain/image-block-fields';
import { normalizeWebLinkUrl } from '../../domain/link-url';
import { $isImageNode, type ImageNode } from '../../domain/nodes/image-node';
import { $isMediaBlockNode } from '../../domain/nodes/media-block';

import { EditorImageFieldForm } from './editor-image-field-form';

/** Gap between the toolbar and the block edge. */
const TOOLBAR_GAP_PX = 6;
/** Toolbar height before it is measured (`h-8` buttons + `p-1`). */
const TOOLBAR_FALLBACK_HEIGHT_PX = 40;
const VIEWPORT_MARGIN_PX = 8;
/** Below this viewport y the toolbar would sit under the fixed site header → place it under the block. */
const MIN_TOOLBAR_TOP_PX = 64;

/** `image` is a media block that also has link / alt text actions. */
type ActiveBlock = { key: NodeKey; kind: 'table' | 'code' | 'media' | 'image' };

type ImageField = 'link' | 'alt';

/** Image link / alt text being edited in the toolbar; tied to one block so a new selection closes it. */
type ImageFieldEdit = { key: NodeKey; field: ImageField; initialValue: string };

type ToolbarPosition = { top: number; left: number };

const BUTTON_BASE_CLASS =
  'flex h-8 shrink-0 items-center gap-1 rounded-btn px-2 text-body-sm font-weight-label transition-colors hover:bg-ghost-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5';
const BUTTON_CLASS = `${BUTTON_BASE_CLASS} text-fg`;

/** Image Link / Alt text button: accent when the image already has that value. */
function imageFieldButtonClass(isSet: boolean): string {
  return `${BUTTON_BASE_CLASS} ${isSet ? 'text-accent' : 'text-fg'}`;
}

/** Keeps the editor selection on toolbar buttons; lets the image field input take focus. */
function preventToolbarMouseDown(event: MouseEvent<HTMLDivElement>) {
  if (event.target instanceof HTMLElement && event.target.closest('input')) {
    return;
  }
  event.preventDefault();
}

/** Block the toolbar is for: a node-selected image / video / line, or the table / code block holding the caret. */
function $activeBlock(): ActiveBlock | null {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const [node] = selection.getNodes();
    if ($isImageNode(node)) {
      return { key: node.getKey(), kind: 'image' };
    }
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

function readImageField(image: ImageNode, field: ImageField): string {
  return field === 'link' ? image.getLinkUrl() : image.getAltText();
}

/**
 * Floating actions for the active non-text block. Every block gets "+ Line up" /
 * "+ Line down" (the touch way out of a table, code, image, video or line — there
 * are no arrow keys on phones); tables keep the legacy +Row / +Column / Remove
 * table; images get Link and Alt text (legacy image link / "image text");
 * images, videos and lines get Remove.
 */
export function EditorBlockToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useI18n();
  const [active, setActive] = useState<ActiveBlock | null>(null);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [toolbarEl, setToolbarEl] = useState<HTMLDivElement | null>(null);
  const [imageFieldEdit, setImageFieldEdit] = useState<ImageFieldEdit | null>(null);
  const [imageFieldsSet, setImageFieldsSet] = useState<Record<ImageField, boolean>>({
    link: false,
    alt: false,
  });

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const { next, linkSet, altSet } = editorState.read(() => {
          const block = $activeBlock();
          const image = block?.kind === 'image' ? $getNodeByKey(block.key) : null;
          return {
            next: block,
            linkSet: $isImageNode(image) && image.getLinkUrl() !== '',
            altSet: $isImageNode(image) && image.getAltText() !== '',
          };
        });
        setActive((prev) => (prev?.key === next?.key && prev?.kind === next?.kind ? prev : next));
        setImageFieldsSet((prev) =>
          prev.link === linkSet && prev.alt === altSet ? prev : { link: linkSet, alt: altSet },
        );
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
    // A compose pill scrolls its content: anchor to the block's visible part, hide when none is.
    const scrollBox = editor.getRootElement()?.getBoundingClientRect();
    const visibleTop = scrollBox ? Math.max(rect.top, scrollBox.top) : rect.top;
    const visibleBottom = scrollBox ? Math.min(rect.bottom, scrollBox.bottom) : rect.bottom;
    if (visibleBottom <= visibleTop) {
      setPosition(null);
      return;
    }
    const height = toolbarEl?.offsetHeight ?? TOOLBAR_FALLBACK_HEIGHT_PX;
    const width = toolbarEl?.offsetWidth ?? 0;
    const above = visibleTop - height - TOOLBAR_GAP_PX;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX;
    setPosition({
      top: above >= MIN_TOOLBAR_TOP_PX ? above : visibleBottom + TOOLBAR_GAP_PX,
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

  const runOnImage = (action: (image: ImageNode) => void) =>
    runOnBlock((block) => {
      if ($isImageNode(block)) {
        action(block);
      }
    });

  const openImageField = (field: ImageField) => {
    if (active?.kind !== 'image') {
      return;
    }
    const initialValue = editor.getEditorState().read(() => {
      const block = $getNodeByKey(active.key);
      return $isImageNode(block) ? readImageField(block, field) : '';
    });
    setImageFieldEdit({ key: active.key, field, initialValue });
  };

  const closeImageField = () => {
    setImageFieldEdit(null);
    editor.focus();
  };

  const writeImageField = (field: ImageField, value: string) => {
    setImageFieldEdit(null);
    runOnImage((image) => (field === 'link' ? image.setLinkUrl(value) : image.setAltText(value)));
  };

  /** Empty input removes the value; an invalid link keeps the form open with an error. */
  const applyImageField = (field: ImageField, raw: string): string | null => {
    if (field === 'alt') {
      writeImageField('alt', normalizeImageAltText(raw));
      return null;
    }
    if (!raw.trim()) {
      writeImageField('link', '');
      return null;
    }
    const url = normalizeWebLinkUrl(raw);
    if (!url) {
      return t('editor_image_link_invalid');
    }
    writeImageField('link', url);
    return null;
  };

  if (!active || !position || typeof document === 'undefined') {
    return null;
  }

  const fieldEdit = imageFieldEdit?.key === active.key ? imageFieldEdit : null;

  return createPortal(
    <div
      ref={setToolbarEl}
      role="toolbar"
      aria-label={t('editor_block_toolbar_aria')}
      className="fixed flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-btn border border-border bg-surface p-1 shadow-card"
      style={{ top: position.top, left: position.left, zIndex: MODAL_Z_INDEX_EDITOR_OVERLAY }}
      onMouseDown={preventToolbarMouseDown}
    >
      {fieldEdit ? (
        <EditorImageFieldForm
          key={`${fieldEdit.key}:${fieldEdit.field}`}
          initialValue={fieldEdit.initialValue}
          inputType={fieldEdit.field === 'link' ? 'url' : 'text'}
          maxLength={fieldEdit.field === 'alt' ? IMAGE_ALT_TEXT_MAX_LENGTH : undefined}
          inputLabel={t(fieldEdit.field === 'link' ? 'editor_format_link' : 'editor_image_alt_text')}
          placeholder={t(
            fieldEdit.field === 'link' ? 'editor_format_link_url' : 'editor_image_alt_placeholder',
          )}
          applyLabel={t('editor_format_link_apply')}
          removeLabel={t(
            fieldEdit.field === 'link' ? 'editor_image_link_remove' : 'editor_image_alt_remove',
          )}
          onApply={(value) => applyImageField(fieldEdit.field, value)}
          onRemove={() => writeImageField(fieldEdit.field, '')}
          onCancel={closeImageField}
        />
      ) : (
        <>
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
      {active.kind === 'image' ? (
        <>
          <button
            type="button"
            className={imageFieldButtonClass(imageFieldsSet.link)}
            aria-pressed={imageFieldsSet.link}
            onClick={() => openImageField('link')}
          >
            <LinkIcon size={16} />
            {t('editor_format_link')}
          </button>
          <button
            type="button"
            className={imageFieldButtonClass(imageFieldsSet.alt)}
            aria-pressed={imageFieldsSet.alt}
            onClick={() => openImageField('alt')}
          >
            <PencilIcon size={16} />
            {t('editor_image_alt_text')}
          </button>
        </>
      ) : null}
      {active.kind === 'media' || active.kind === 'image' ? (
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
        </>
      )}
    </div>,
    document.body,
  );
}
