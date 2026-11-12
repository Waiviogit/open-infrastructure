'use client';

import { useIpfsContentBaseUrl } from '@/config/ipfs-content-base-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { BlogPostScreen, PostInterceptModalShell } from '@/modules/feed/presentation';
import { FeedColumn } from '@/shared/presentation/layout';

import { buildEditorPreviewPayload } from '../../application/build-editor-preview-payload';
import type { PostEditorLinkedObject } from '../../domain/post-editor-linked-object';

export type EditorPostPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  username: string;
  title: string;
  bodyLexicalJson: string;
  linkedObjects: readonly PostEditorLinkedObject[];
  searchResultsById: Readonly<Record<string, SearchObjectResult>>;
};

export function EditorPostPreviewModal({
  open,
  onClose,
  username,
  title,
  bodyLexicalJson,
  linkedObjects,
  searchResultsById,
}: EditorPostPreviewModalProps) {
  const { t } = useI18n();
  const contentBaseUrl = useIpfsContentBaseUrl();

  if (!open) {
    return null;
  }

  const payload = buildEditorPreviewPayload({
    authorUsername: username,
    title,
    bodyLexicalJson,
    linkedObjects,
    searchResultsById,
    contentBaseUrl,
  });

  return (
    <PostInterceptModalShell onClose={onClose} showShareActions={false}>
      <FeedColumn>
        <BlogPostScreen
          variant="modal"
          story={payload.story}
          bodyHtmlSafe={payload.bodyHtmlSafe}
          currentUsername={username}
          timeLabelOverride={t('preview')}
        />
      </FeedColumn>
    </PostInterceptModalShell>
  );
}
