'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { HostBodyTabDefinition } from '../../domain/host-body-tab';
import type { ProjectedGalleryAlbumView } from '../../domain/object-page.types';
import { HtmlSandboxFrame } from './html-sandbox-frame';
import { ObjectHostBodyEditor } from './object-host-body-editor';
import { ObjectPageContentBody } from './object-page-content-body';

export type ObjectHostBodyContentProps = {
  objectId: string;
  objectTitle: string;
  tab: HostBodyTabDefinition;
  /** The tab's body (`htmlContent` normalized, `pageContent` / `legalText` raw), or null. */
  body: string | null;
  isEditMode: boolean;
  viewerUsername: string | null;
  onOpenGalleryPhoto?: (album: ProjectedGalleryAlbumView, photoIndex: number) => void;
};

/**
 * Host body tab (HTML, Page, Document): the body with the renderer of its format; in edit mode,
 * the editor with preview and publish.
 */
export function ObjectHostBodyContent({
  objectId,
  objectTitle,
  tab,
  body,
  isEditMode,
  viewerUsername,
  onOpenGalleryPhoto,
}: ObjectHostBodyContentProps) {
  const { t } = useI18n();
  const source = body?.trim() ?? '';

  if (isEditMode && viewerUsername) {
    return (
      <ObjectHostBodyEditor
        key={`${viewerUsername}:${objectId}`}
        objectId={objectId}
        objectTitle={objectTitle}
        tab={tab}
        currentSource={source}
        viewerUsername={viewerUsername}
      />
    );
  }

  if (!source) {
    return (
      <div className="rounded-card border border-border bg-surface/60 p-card-padding text-body-sm text-muted">
        <p className="text-fg">{t(tab.emptyMessageKey)}</p>
      </div>
    );
  }

  if (tab.format === 'html') {
    return (
      <div className="overflow-hidden rounded-card border border-border">
        <HtmlSandboxFrame source={source} title={objectTitle} />
      </div>
    );
  }

  return <ObjectPageContentBody rawContent={source} onOpenGalleryPhoto={onOpenGalleryPhoto} />;
}
