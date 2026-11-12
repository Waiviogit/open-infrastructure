'use client';

import { createLinkMatcherWithRegExp } from '@lexical/link';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { imageContentUrlForCid } from '@/config/ipfs-content-url';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import {
  POST_BODY_BLOCK_CLASSES,
  POST_BODY_EDITORIAL_CLASSES,
} from '@/modules/feed/presentation/components/post-body-typography';

import {
  isLexicalDraftJson,
  migrateLegacyImageNodeTypes,
  normalizeImageNodeSrcFromCid,
  serializeEditorState,
} from '../../application/editor-body-serialization';
import { $importPostMarkdown } from '../../application/post-markdown-import';
import { POST_EDITOR_NODES } from '../../domain/editor-lexical-nodes';
import { EditorBlankDocumentResetPlugin } from './editor-blank-document-reset-plugin';
import { EditorFormatToolbar } from './editor-format-toolbar';
import { EditorHashObjectSearchPlugin } from './editor-hash-object-search-plugin';
import { EditorImageDropOverlay } from './editor-image-drop-overlay';
import { EditorInsertCaretOverlay } from './editor-insert-menu';
import { EditorImageKeyboardPlugin } from './editor-image-keyboard-plugin';
import { EditorPasteImagePlugin } from './editor-paste-image-plugin';
import { EditorPasteObjectLinksPlugin } from './editor-paste-object-links-plugin';
import { EditorPasteRichHtmlPlugin } from './editor-paste-rich-html-plugin';
import { EditorPasteVideoUrlPlugin } from './editor-paste-video-url-plugin';
import { EditorBlockToolbarPlugin } from './editor-block-toolbar-plugin';
import { EditorBlockGapsPlugin } from './editor-block-gaps-plugin';
import { EditorRegisterImagePlugin } from './editor-register-image-plugin';

const URL_REG_EXP =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

/** Pill compose: insert btn radius (20px) + 10px gap before text (half of legacy ps-10 inset). */
const PILL_COMPOSE_TEXT_INSET = 'ps-[1.875rem]';
const PILL_COMPOSE_PLACEHOLDER_START = 'start-[1.875rem]';

const lexicalTheme = {
  paragraph: 'mb-2 text-body text-fg font-weight-body leading-body',
  quote:
    'mb-2 border-s-4 border-border ps-4 text-body italic text-fg-secondary leading-body',
  heading: {
    h1: 'mb-2 font-display text-section text-heading leading-display',
    h2: 'mb-2 font-display text-body-lg text-heading leading-body',
    h3: 'mb-2 font-display text-body text-heading leading-body',
    h4: 'mb-1 font-display text-body-sm text-heading leading-compressed',
    h5: 'mb-1 font-label text-body-sm text-heading leading-compressed',
    h6: 'mb-1 font-label text-caption text-fg-secondary leading-compressed',
  },
  list: {
    ul: 'mb-2 list-disc ps-6 text-body text-fg leading-body',
    ol: 'mb-2 list-decimal ps-6 text-body text-fg leading-body',
    listitem: 'mb-0.5',
    nested: {
      listitem: 'list-none before:hidden',
    },
  },
  link: 'text-link underline underline-offset-2 hover:text-accent-alt',
  code: 'mb-2 block overflow-x-auto whitespace-pre bg-code-bg p-card-padding font-mono text-body-sm text-code-fg',
  hr: 'my-4 border-0 border-t border-border',
  /**
   * Legacy parity: equal fixed columns, long text wraps and grows the row, rows
   * striped white / grey (`.editor-table` in global.css). The GFM header row looks
   * like any other row.
   */
  table: 'editor-table mb-2 w-full table-fixed border-collapse text-body',
  tableCell: 'border border-border px-2 py-1 align-top text-start text-fg whitespace-normal break-words',
  tableCellHeader: 'font-weight-body',
  tableSelection: 'bg-accent-soft',
  image: 'my-2 block w-full overflow-hidden rounded-card',
  video: 'my-2 block w-full',
  text: {
    bold: 'font-weight-strong',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'rounded-btn bg-surface-muted px-0.5 font-mono text-body-sm',
    spoiler:
      'cursor-pointer rounded-btn bg-surface-muted px-0.5 text-fg hover:bg-accent/20',
  },
};

/** Compose pill: no paragraph margin, so a single line sits centred in the field. */
const composeLexicalTheme = {
  ...lexicalTheme,
  paragraph: 'mb-0 text-body text-fg font-weight-body leading-body',
};

/**
 * Full post editor: paragraphs, quotes, H1–H3 and lists take their look from the content area
 * (`POST_BODY_BLOCK_CLASSES`, same as the published post / preview), so these node classes stay minimal.
 */
const postLexicalTheme = {
  ...lexicalTheme,
  paragraph: undefined,
  quote: undefined,
  heading: {
    ...lexicalTheme.heading,
    h1: undefined,
    h2: undefined,
    h3: undefined,
  },
  list: {
    ...lexicalTheme.list,
    ul: 'list-disc',
    ol: 'list-decimal',
  },
};

/** Content area of the full post editor: the post modal / preview typography. */
const POST_EDITOR_CONTENT_CLASSES = [
  'relative resize-y text-fg outline-none',
  POST_BODY_EDITORIAL_CLASSES,
  POST_BODY_BLOCK_CLASSES,
  // In the post the body's top margin collapses with the first heading; here it would add a gap.
  '[&>:first-child]:mt-0',
].join(' ');

/**
 * Layout chrome only. Every variant mounts the same formatting and editing plugins:
 * - `document`: the full post page (`/editor`, drafts) with the published-post typography;
 * - `compose`: the pill field of comments, threads, object activity, DMs and activity notes.
 */
export type EditorVariant = 'document' | 'compose';

type VariantChrome = {
  theme: typeof lexicalTheme | typeof postLexicalTheme;
  shellClass: string;
  contentClass: string;
  placeholderClass: string;
  /** (+) pinned to the vertical centre of the field instead of following the caret line. */
  pinInsertCenterVertical: boolean;
};

const DOCUMENT_CHROME: VariantChrome = {
  theme: postLexicalTheme,
  shellClass: 'min-h-[12rem]',
  contentClass: `${POST_EDITOR_CONTENT_CLASSES} px-4 ps-8 py-3 min-h-[12rem]`,
  placeholderClass: 'start-8 top-3 font-editorial leading-editorial',
  pinInsertCenterVertical: false,
};

function composeChrome(composeTrailingInset: boolean): VariantChrome {
  return {
    theme: composeLexicalTheme,
    shellClass: 'min-h-11 max-h-32',
    contentClass: [
      'relative text-body leading-body text-fg outline-none',
      PILL_COMPOSE_TEXT_INSET,
      composeTrailingInset ? 'pe-24' : 'pe-4',
      'py-[calc((2.75rem-1.43em)/2)] min-h-11 max-h-32 resize-y overflow-y-auto',
    ].join(' '),
    placeholderClass: `${PILL_COMPOSE_PLACEHOLDER_START} top-1/2 -translate-y-1/2 leading-body`,
    pinInsertCenterVertical: true,
  };
}

function InitialBodyPlugin({ body }: { body: string }) {
  const [editor] = useLexicalComposerContext();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) {
      return;
    }
    applied.current = true;
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    if (isLexicalDraftJson(trimmed)) {
      const migrated = migrateLegacyImageNodeTypes(trimmed);
      editor.setEditorState(editor.parseEditorState(migrated));
      if (contentBaseUrl) {
        normalizeImageNodeSrcFromCid(editor, contentBaseUrl, imageContentUrlForCid);
      }
      return;
    }

    // Any other body is published markdown (post, comment, thread, message, note) being edited.
    editor.update(() => {
      $importPostMarkdown(trimmed);
    });
  }, [body, contentBaseUrl, editor]);

  return null;
}

function LexicalAutoLinkConfigured() {
  const matchers = useMemo(
    () => [createLinkMatcherWithRegExp(URL_REG_EXP, (text) => text)],
    [],
  );
  return <AutoLinkPlugin matchers={matchers} />;
}

function EditorBodyOnChangePlugin({ onBodyChange }: { onBodyChange: (body: string) => void }) {
  const [editor] = useLexicalComposerContext();

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={() => {
        onBodyChange(serializeEditorState(editor));
      }}
    />
  );
}

/**
 * The single plugin set of every editor instance. Add a formatting or editing feature here, once:
 * never gate it by variant or surface. Only context the consumer supplies stays conditional
 * (`#` search needs the author, pasted object links need the post's linked-object list).
 */
function EditorInner({
  chrome,
  bodyPlaceholder,
  initialBody,
  onBodyChange,
  onObjectLinkedFromEditor,
  hashObjectSearch,
}: {
  chrome: VariantChrome;
  bodyPlaceholder: string;
  initialBody?: string;
  onBodyChange?: (body: string) => void;
  onObjectLinkedFromEditor?: (result: SearchObjectResult) => void;
  hashObjectSearch?: HashObjectSearchConfig;
}) {
  return (
    <>
      {initialBody ? <InitialBodyPlugin body={initialBody} /> : null}
      {onBodyChange ? <EditorBodyOnChangePlugin onBodyChange={onBodyChange} /> : null}
      <RichTextPlugin
        contentEditable={
          <ContentEditable className={`${chrome.contentClass} focus-visible:outline-none`} />
        }
        placeholder={
          <div
            className={[
              'pointer-events-none absolute text-body text-fg-tertiary select-none',
              chrome.placeholderClass,
            ].join(' ')}
          >
            {bodyPlaceholder}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <LexicalAutoLinkConfigured />
      <EditorFormatToolbar />
      <EditorBlankDocumentResetPlugin />
      <TablePlugin hasCellMerge={false} hasCellBackgroundColor={false} />
      <EditorBlockToolbarPlugin />
      <EditorBlockGapsPlugin />
      <EditorPasteVideoUrlPlugin />
      <EditorPasteRichHtmlPlugin />
      <EditorRegisterImagePlugin />
      <EditorPasteImagePlugin />
      <EditorImageKeyboardPlugin />
      {onObjectLinkedFromEditor ? (
        <EditorPasteObjectLinksPlugin onObjectLinkedFromEditor={onObjectLinkedFromEditor} />
      ) : null}
      {hashObjectSearch ? (
        <EditorHashObjectSearchPlugin
          username={hashObjectSearch.username}
          googlePlaces={hashObjectSearch.googlePlaces}
          onObjectLinkedFromEditor={onObjectLinkedFromEditor}
        />
      ) : null}
    </>
  );
}

/** `#` object search for this author; Google Maps places too when `googlePlaces` (post editor flag). */
export type HashObjectSearchConfig = {
  username: string;
  /** Also search Google Maps places (off: our objects only). */
  googlePlaces: boolean;
};

export type LexicalEditorProps = {
  /** Layout chrome; the formatting and editing features are the same for every variant. */
  variant: EditorVariant;
  bodyPlaceholder: string;
  /** Lexical JSON (draft) or a published markdown body (edit), imported as markdown. */
  initialBody?: string;
  /** Lexical JSON on every change; the consumer turns it into markdown with `editorBodyToMarkdown`. */
  onBodyChange?: (bodyLexicalJson: string) => void;
  /** Post editor: add an object linked in the body (Insert → Object, `#`, paste) to the post metadata. */
  onObjectLinkedFromEditor?: (result: SearchObjectResult) => void;
  /** Enables `#` object search; pass it wherever there is a signed-in author. */
  hashObjectSearch?: HashObjectSearchConfig;
  /** `compose`: room on the right for in-field controls (lock + send in the DM bar). */
  composeTrailingInset?: boolean;
  /** Object activity metadata: show Date in the insert menu. */
  enableOriginalCreatedAt?: boolean;
  /** Object activity: open the insert panel below (+). */
  insertPanelPreferBelow?: boolean;
  renderOriginalDatePicker?: (props: { onSelect: (unix: number) => void }) => ReactNode;
  onOriginalCreatedAtSelected?: (unix: number) => void;
};

export function LexicalPostEditor({
  variant,
  bodyPlaceholder,
  initialBody,
  onBodyChange,
  onObjectLinkedFromEditor,
  hashObjectSearch,
  composeTrailingInset = false,
  enableOriginalCreatedAt,
  insertPanelPreferBelow,
  renderOriginalDatePicker,
  onOriginalCreatedAtSelected,
}: LexicalEditorProps) {
  const chrome = useMemo(
    () => (variant === 'document' ? DOCUMENT_CHROME : composeChrome(composeTrailingInset)),
    [composeTrailingInset, variant],
  );

  const initialConfig = useMemo(
    () => ({
      namespace: 'PostEditor',
      theme: chrome.theme,
      onError: (error: Error) => {
        console.error(error);
      },
      nodes: [...POST_EDITOR_NODES],
    }),
    [chrome.theme],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={[
          'relative w-full overflow-visible rounded-card border border-border bg-surface shadow-card',
          chrome.shellClass,
        ].join(' ')}
      >
        <EditorInner
          chrome={chrome}
          bodyPlaceholder={bodyPlaceholder}
          initialBody={initialBody}
          onBodyChange={onBodyChange}
          onObjectLinkedFromEditor={onObjectLinkedFromEditor}
          hashObjectSearch={hashObjectSearch}
        />
        <EditorImageDropOverlay />
        <EditorInsertCaretOverlay
          pinInsertCenterVertical={chrome.pinInsertCenterVertical}
          onObjectLinkedFromEditor={onObjectLinkedFromEditor}
          enableOriginalCreatedAt={enableOriginalCreatedAt}
          insertPanelPreferBelow={insertPanelPreferBelow}
          renderOriginalDatePicker={renderOriginalDatePicker}
          onOriginalCreatedAtSelected={onOriginalCreatedAtSelected}
        />
      </div>
    </LexicalComposer>
  );
}
