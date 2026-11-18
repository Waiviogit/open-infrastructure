'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { UPDATE_REGISTRY } from '@opden-data-layer/core/update-registry';
import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';
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
import { revalidateObjectAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import {
  buildHtmlEditorMarkdown,
  extractHtmlFromEditorMarkdown,
  type HtmlEditorExtractError,
} from '../../domain/html-content-source';
import { HtmlSandboxFrame } from './html-sandbox-frame';

const EXTRACT_ERROR_MESSAGE_KEYS: Record<HtmlEditorExtractError, string> = {
  empty: 'object_html_error_empty',
  code_block_required: 'object_html_error_code_block_required',
  not_html: 'object_html_error_not_html',
};

const SECONDARY_BUTTON_CLASS =
  'rounded-btn border border-border px-4 py-2 text-body-sm font-weight-label text-fg hover:bg-surface disabled:opacity-50';
const PRIMARY_BUTTON_CLASS =
  'rounded-btn bg-accent px-4 py-2 text-body-sm font-weight-label text-accent-fg hover:opacity-90 disabled:opacity-50';

type EditorStep = 'edit' | 'preview';

export type ObjectHtmlEditorProps = {
  objectId: string;
  objectTitle: string;
  /** The page shown on the HTML tab now (normalized), or `''` when there is none. */
  currentSource: string;
  viewerUsername: string;
};

/**
 * Edit → Preview → Publish for an `html` object. The page is edited in the one app editor as a
 * single `html` code block; Publish broadcasts a new `htmlContent` update (IPFS batch when the
 * page is over the custom_json limit).
 */
export function ObjectHtmlEditor({
  objectId,
  objectTitle,
  currentSource,
  viewerUsername,
}: ObjectHtmlEditorProps) {
  useHydrateWalletProvider();
  const { t, locale: uiLocale } = useI18n();
  const router = useRouter();
  const odlCustomJsonId = useOdlCustomJsonId();
  const contentBaseUrl = useIpfsContentBaseUrl();

  const [initialMarkdown] = useState(() => buildHtmlEditorMarkdown(currentSource));
  const [bodyJson, setBodyJson] = useState<string | null>(null);
  const [step, setStep] = useState<EditorStep>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [locale, setLocale] = useState<string>(uiLocale);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onPreview = useCallback(() => {
    const markdown =
      bodyJson == null ? initialMarkdown : editorBodyToMarkdown(bodyJson, contentBaseUrl);
    const extracted = extractHtmlFromEditorMarkdown(markdown);
    setNotice(null);
    if (!extracted.ok) {
      setError(t(EXTRACT_ERROR_MESSAGE_KEYS[extracted.error]));
      return;
    }
    if (extracted.html === currentSource) {
      setError(t('object_html_error_unchanged'));
      return;
    }
    setError(null);
    setPreviewHtml(extracted.html);
    setStep('preview');
  }, [bodyJson, contentBaseUrl, currentSource, initialMarkdown, t]);

  const onBackToEdit = useCallback(() => {
    setError(null);
    setStep('edit');
  }, []);

  const onPublish = useCallback(async () => {
    const definition = UPDATE_REGISTRY[UPDATE_TYPES.HTML_CONTENT];
    if (!definition || submitting) {
      return;
    }
    const parsed = validateUpdateValue(definition, previewHtml);
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
        updateType: UPDATE_TYPES.HTML_CONTENT,
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
      setNotice(t('object_html_published'));
      void refreshAfterBroadcast(router, () => revalidateObjectAfterBroadcast(objectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('object_edit_validation_error'));
      setSubmitting(false);
    }
  }, [locale, objectId, odlCustomJsonId, previewHtml, router, submitting, t, viewerUsername]);

  const inPreview = step === 'preview';

  return (
    <div className="space-y-4">
      {inPreview ? null : (
        <p className="text-body-sm text-muted">{t('object_html_editor_hint')}</p>
      )}

      <div className={inPreview ? 'hidden' : undefined}>
        <LexicalPostEditor
          variant="document"
          bodyPlaceholder={t('object_html_editor_placeholder')}
          initialBody={initialMarkdown}
          onBodyChange={setBodyJson}
        />
      </div>

      {inPreview ? (
        <section aria-labelledby="object-html-preview-title" className="space-y-2">
          <h2
            id="object-html-preview-title"
            className="text-section font-display font-weight-display text-heading"
          >
            {t('object_html_preview')}
          </h2>
          <p className="text-body-sm text-muted">{t('object_html_preview_hint')}</p>
          <div className="overflow-hidden rounded-card border border-border">
            <HtmlSandboxFrame source={previewHtml} title={objectTitle} />
          </div>
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
            {t('object_html_back_to_edit')}
          </button>
          <button
            type="button"
            onClick={() => void onPublish()}
            disabled={submitting}
            className={PRIMARY_BUTTON_CLASS}
          >
            {submitting ? t('object_html_publishing') : t('object_html_publish')}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={onPreview} className={PRIMARY_BUTTON_CLASS}>
            {t('object_html_preview')}
          </button>
        </div>
      )}
    </div>
  );
}
