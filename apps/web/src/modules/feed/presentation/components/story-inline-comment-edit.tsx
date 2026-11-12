'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { CommentEditState } from '../hooks/use-comment-edit-target';

import { StoryCommentEditor } from './story-comment-editor';

export type StoryInlineCommentEditProps = {
  state: CommentEditState;
  /** Root story the comment belongs to (feed card: the item itself). */
  story: FeedStoryView;
  currentUsername: string;
  onClose: () => void;
  onSaved: () => void;
  onBroadcastRevalidate?: () => Promise<void>;
};

/** The same compose editor as a reply, seeded with the published comment or thread. */
export function StoryInlineCommentEdit({
  state,
  story,
  currentUsername,
  onClose,
  onSaved,
  onBroadcastRevalidate,
}: StoryInlineCommentEditProps) {
  const { t } = useI18n();

  if (state.status === 'loading') {
    return (
      <p className="mt-2 text-body-sm text-fg-secondary" role="status">
        {t('comment_edit_loading')}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-body-sm text-error" role="alert">
          {t('comment_edit_load_failed')}
        </p>
        <button
          type="button"
          className="rounded-btn px-2 py-0.5 text-caption text-muted hover:bg-surface-control hover:text-fg-secondary"
          onClick={onClose}
        >
          {t('cancel')}
        </button>
      </div>
    );
  }
  if (state.status !== 'ready') {
    return null;
  }
  return (
    <StoryCommentEditor
      story={story}
      currentUsername={currentUsername}
      editTarget={state.target}
      onCancel={onClose}
      onSaved={onSaved}
      onBroadcastRevalidate={onBroadcastRevalidate}
    />
  );
}
