'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { UPDATE_REGISTRY } from '@opden-data-layer/core/update-registry';
import { buildOdlUpdateCreateOp } from '@opden-data-layer/hive-broadcast';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { useOdlCustomJsonId } from '@/config/odl-network-provider';
import { locales } from '@/i18n/config/locales';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { useHydrateWalletProvider } from '@/modules/auth';
import { LexicalPostEditor, editorBodyToMarkdown } from '@/modules/editor';
import { broadcastOdlOpWithOverflow } from '@/modules/object-updates/application/broadcast-odl-op-with-overflow';
import { broadcastOverflowErrorMessage } from '@/modules/object-updates/application/broadcast-overflow-error-message';
import { validateUpdateValue } from '@/modules/object-updates/application/update-value-form.utils';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { formatAbsoluteDateTime } from '@/shared/utils/format-relative-time';
import { revalidateObjectAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import {
  buildHostBodyEditorMarkdown,
  extractHostBodyFromEditorMarkdown,
  type HostBodyExtractError,
} from '../../domain/host-body-editor';
import type { HostBodyDraft, HostBodyDraftRepository } from '../../domain/host-body-draft';
import type { HostBodyFormat, HostBodyTabDefinition } from '../../domain/host-body-tab';
import { useHostBodyDraft } from '../hooks/use-host-body-draft';
import { HtmlSandboxFrame } from './html-sandbox-frame';
import { ObjectPageContentBody } from './object-page-content-body';

type FormatMessageKeys = {
  hint: string;
  placeholder: string;
  previewHint: string;
  errors: Record<HostBodyExtractError, string>;
};

const MESSAGE_KEYS: Record<HostBodyFormat, FormatMessageKeys> = {
  html: {
    hint: 'object_html_editor_hint',
    placeholder: 'object_html_editor_placeholder',
    previewHint: 'object_html_preview_hint',
    errors: {
      empty: 'object_html_error_empty',
      code_block_required: 'object_html_error_code_block_required',
      not_html: 'object_html_error_not_html',
    },
  },
  markdown: {
    hint: 'object_body_editor_hint',
    placeholder: 'object_body_editor_placeholder',
    previewHint: 'object_body_preview_hint',
    errors: {
      empty: 'object_body_error_empty',
      code_block_required: 'object_body_error_empty',
      not_html: 'object_body_error_empty',
    },
  },
};

const SECONDARY_BUTTON_CLASS =
  'rounded-btn border border-border px-4 py-2 text-body-sm font-weight-label text-fg hover:bg-surface disabled:opacity-50';
const PRIMARY_BUTTON_CLASS =
  'rounded-btn bg-accent px-4 py-2 text-body-sm font-weight-label text-accent-fg hover:opacity-90 disabled:opacity-50';

type EditorStep = 'edit' | 'preview';

export type ObjectHostBodyEditorProps = {
  objectId: string;
  objectTitle: string;
  tab: HostBodyTabDefinition;
  /** The body shown on the tab now, or `''` when there is none. */
  currentSource: string;
  viewerUsername: string;
  /** Drafts store override (tests); defaults to the app's local drafts. */
  draftRepository?: HostBodyDraftRepository;
};

function DraftBanner({
  draft,
  isStale,
  onContinue,
  onDiscard,
}: {
  draft: HostBodyDraft;
  isStale: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { t, locale } = useI18n();
  const iso = new Date(draft.updatedAt).toISOString();
  const [before, after = ''] = t('object_body_draft_found').split('{time}');
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-card-padding text-body-sm"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-fg">
          {before}
          <time dateTime={iso}>{formatAbsoluteDateTime(iso, locale)}</time>
          {after}
        </p>
        {isStale ? <p className="text-muted">{t('object_body_draft_stale')}</p> : null}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDiscard} className={SECONDARY_BUTTON_CLASS}>
          {t('object_body_draft_discard')}
        </button>
        <button type="button" onClick={onContinue} className={PRIMARY_BUTTON_CLASS}>
          {t('object_body_draft_continue')}
        </button>
      </div>
    </div>
  );
}

/**
 * Edit → Preview → Publish for a host body tab (HTML, Page, Document). The body is edited in the
 * one app editor (an HTML page as a single `html` code block, rich text as itself); the preview
 * uses the same renderer as the tab; Publish broadcasts a new body update (IPFS batch when it is
 * over the custom_json limit).
 */
export function ObjectHostBodyEditor({
  objectId,
  objectTitle,
  tab,
  currentSource,
  viewerUsername,
  draftRepository,
}: ObjectHostBodyEditorProps) {
  useHydrateWalletProvider();
  const { t, locale: uiLocale } = useI18n();
  const router = useRouter();
  const odlCustomJsonId = useOdlCustomJsonId();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const keys = MESSAGE_KEYS[tab.format];

  const [initialMarkdown] = useState(() => buildHostBodyEditorMarkdown(tab.format, currentSource));
  const [editorSeed, setEditorSeed] = useState(initialMarkdown);
  const [editorKey, setEditorKey] = useState(0);
  const [bodyJson, setBodyJson] = useState<string | null>(null);
  const [step, setStep] = useState<EditorStep>('edit');
  const [previewBody, setPreviewBody] = useState('');
  const [locale, setLocale] = useState<string>(uiLocale);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const draft = useHostBodyDraft({
    username: viewerUsername,
    objectId,
    tab,
    currentSource,
    repository: draftRepository,
  });
  const { onBodyChange: onDraftBodyChange, continueDraft, discardDraft, onPublished } = draft;

  const handleBodyChange = useCallback(
    (json: string) => {
      setBodyJson(json);
      onDraftBodyChange(json);
    },
    [onDraftBodyChange],
  );

  const onContinueDraft = useCallback(() => {
    const body = continueDraft();
    if (body == null) {
      return;
    }
    setEditorSeed(body);
    setBodyJson(body);
    setEditorKey((value) => value + 1);
    setError(null);
    setNotice(null);
  }, [continueDraft]);

  const onPreview = useCallback(() => {
    const markdown =
      bodyJson == null ? initialMarkdown : editorBodyToMarkdown(bodyJson, contentBaseUrl);
    const extracted = extractHostBodyFromEditorMarkdown(tab.format, markdown);
    setNotice(null);
    if (!extracted.ok) {
      setError(t(keys.errors[extracted.error]));
      return;
    }
    if (extracted.body === currentSource.trim()) {
      setError(t('object_body_error_unchanged'));
      return;
    }
    setError(null);
    setPreviewBody(extracted.body);
    setStep('preview');
  }, [bodyJson, contentBaseUrl, currentSource, initialMarkdown, keys, t, tab.format]);

  const onBackToEdit = useCallback(() => {
    setError(null);
    setStep('edit');
  }, []);

  const onPublish = useCallback(async () => {
    const definition = UPDATE_REGISTRY[tab.updateType];
    if (!definition || submitting) {
      return;
    }
    const parsed = validateUpdateValue(definition, previewBody);
    if (!parsed.success) {
      setError(t('object_edit_validation_error'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const op = buildOdlUpdateCreateOp({
        id: odlCustomJsonId,
        objectId,
        updateType: tab.updateType,
        creator: viewerUsername,
        valueKind: definition.value_kind,
        value: parsed.value,
        locale: definition.localizable ? locale : undefined,
        required_posting_auths: [viewerUsername],
      });
      const result = await broadcastOdlOpWithOverflow({
        op,
        account: viewerUsername,
        odlCustomJsonId,
        objectId,
      });
      if (!result.success) {
        setError(broadcastOverflowErrorMessage(result.error, t));
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setStep('edit');
      onPublished(previewBody);
      setNotice(t('object_body_published'));
      void refreshAfterBroadcast(router, () => revalidateObjectAfterBroadcast(objectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('object_edit_validation_error'));
      setSubmitting(false);
    }
  }, [
    locale,
    objectId,
    odlCustomJsonId,
    onPublished,
    previewBody,
    router,
    submitting,
    t,
    tab.updateType,
    viewerUsername,
  ]);

  const inPreview = step === 'preview';

  return (
    <div className="space-y-4">
      {!inPreview && draft.pendingDraft ? (
        <DraftBanner
          draft={draft.pendingDraft}
          isStale={draft.isStale}
          onContinue={onContinueDraft}
          onDiscard={discardDraft}
        />
      ) : null}

      {inPreview ? null : <p className="text-body-sm text-muted">{t(keys.hint)}</p>}

      {draft.status === 'loading' ? (
        <div
          className={[
            'min-h-[12rem] animate-pulse rounded-card border border-border bg-surface',
            inPreview ? 'hidden' : '',
          ].join(' ')}
          aria-busy="true"
        />
      ) : (
        <div
          className={inPreview ? 'hidden' : undefined}
          onKeyDown={draft.markUserInput}
          onPaste={draft.markUserInput}
          onDrop={draft.markUserInput}
          onCut={draft.markUserInput}
          onPointerDown={draft.markUserInput}
        >
          <LexicalPostEditor
            key={editorKey}
            variant="document"
            bodyPlaceholder={t(keys.placeholder)}
            initialBody={editorSeed}
            onBodyChange={handleBodyChange}
            hashObjectSearch={{ username: viewerUsername, googlePlaces: false }}
          />
        </div>
      )}

      {inPreview ? (
        <section aria-labelledby="object-host-body-preview-title" className="space-y-2">
          <h2
            id="object-host-body-preview-title"
            className="text-section font-display font-weight-display text-heading"
          >
            {t('object_body_preview')}
          </h2>
          <p className="text-body-sm text-muted">{t(keys.previewHint)}</p>
          {tab.format === 'html' ? (
            <div className="overflow-hidden rounded-card border border-border">
              <HtmlSandboxFrame source={previewBody} title={objectTitle} />
            </div>
          ) : (
            <ObjectPageContentBody rawContent={previewBody} />
          )}
        </section>
      ) : null}

      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-body-sm text-success" role="status">
          {notice}
        </p>
      ) : null}

      {inPreview ? (
        <div className="flex flex-wrap items-end justify-end gap-2">
          <label className="mr-auto block text-body-sm">
            <span className="font-weight-label text-fg">{t('object_edit_locale_label')}</span>
            <select
              className="mt-2 block rounded-btn border border-border bg-bg px-3 py-2 text-fg"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={submitting}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onBackToEdit}
            disabled={submitting}
            className={SECONDARY_BUTTON_CLASS}
          >
            {t('object_body_back_to_edit')}
          </button>
          <button
            type="button"
            onClick={() => void onPublish()}
            disabled={submitting}
            className={PRIMARY_BUTTON_CLASS}
          >
            {submitting ? t('object_body_publishing') : t('object_body_publish')}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={onPreview} className={PRIMARY_BUTTON_CLASS}>
            {t('object_body_preview')}
          </button>
        </div>
      )}
    </div>
  );
}
