'use client';

import { useCallback, useMemo, useRef } from 'react';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { LexicalPostEditor, editorBodyToMarkdown } from '@/modules/editor';
import { COMPACT_BODY_BLOCK_CLASSES } from '@/modules/feed/presentation/components/post-body-typography';
import { sanitizePostBodyHtml } from '@/shared/infrastructure/post-body-html-pipeline';
import { SocialEmbedHtml } from '@/shared/presentation';

const PREVIEW_BODY_CLASS = `blog-post-body break-words text-body-sm text-fg ${COMPACT_BODY_BLOCK_CLASSES}`;

export type ProfileSignatureFieldProps = {
  username: string;
  /** Signature stored on chain when the editor mounted (remount the field to reset). */
  initialSignature: string;
  value: string;
  onChange: (markdown: string) => void;
};

/**
 * Signature markdown in the shared editor + live preview. The editor re-exports the imported
 * markdown on mount; that first round trip maps back to the stored value so the form stays clean.
 */
export function ProfileSignatureField({
  username,
  initialSignature,
  value,
  onChange,
}: ProfileSignatureFieldProps) {
  const { t } = useI18n();
  const contentBaseUrl = useIpfsContentBaseUrl();
  const importedMarkdownRef = useRef<string | null>(initialSignature ? null : '');

  const handleBodyChange = useCallback(
    (bodyLexicalJson: string) => {
      const markdown = editorBodyToMarkdown(bodyLexicalJson, contentBaseUrl);
      if (importedMarkdownRef.current === null) {
        importedMarkdownRef.current = markdown;
        return;
      }
      onChange(markdown === importedMarkdownRef.current ? initialSignature : markdown);
    },
    [contentBaseUrl, initialSignature, onChange],
  );

  const previewHtml = useMemo(() => (value.trim() ? sanitizePostBodyHtml(value) : ''), [value]);

  return (
    <div>
      <p className="mb-2 text-body font-weight-label text-fg">{t('profile_signature')}</p>
      <LexicalPostEditor
        variant="compose"
        bodyPlaceholder={t('profile_signature_placeholder')}
        initialBody={initialSignature || undefined}
        onBodyChange={handleBodyChange}
        hashObjectSearch={{ username, googlePlaces: false }}
      />
      {previewHtml ? (
        <div className="mt-3">
          <p className="mb-1 text-caption text-fg-muted">{t('preview')}</p>
          <SocialEmbedHtml
            html={previewHtml}
            className={`${PREVIEW_BODY_CLASS} rounded-card border border-border p-card-padding`}
          />
        </div>
      ) : null}
    </div>
  );
}
