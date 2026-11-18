'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { HtmlSandboxFrame } from './html-sandbox-frame';
import { ObjectHtmlEditor } from './object-html-editor';

export type ObjectHtmlContentProps = {
  objectId: string;
  objectTitle: string;
  /** Normalized `htmlContent` page, or null when the object has none yet. */
  htmlContent: string | null;
  isEditMode: boolean;
  viewerUsername: string | null;
};

/** HTML tab: the object's page in a sandbox; in edit mode, the editor with preview and publish. */
export function ObjectHtmlContent({
  objectId,
  objectTitle,
  htmlContent,
  isEditMode,
  viewerUsername,
}: ObjectHtmlContentProps) {
  const { t } = useI18n();

  if (isEditMode && viewerUsername) {
    return (
      <ObjectHtmlEditor
        key={objectId}
        objectId={objectId}
        objectTitle={objectTitle}
        currentSource={htmlContent ?? ''}
        viewerUsername={viewerUsername}
      />
    );
  }

  if (!htmlContent) {
    return (
      <div className="rounded-card border border-border bg-surface/60 p-card-padding text-body-sm text-muted">
        <p className="text-fg">{t('object_html_empty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <HtmlSandboxFrame source={htmlContent} title={objectTitle} />
    </div>
  );
}
