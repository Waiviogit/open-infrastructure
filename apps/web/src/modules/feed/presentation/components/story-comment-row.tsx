'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { sanitizePostBodyHtml } from '@/shared/infrastructure/post-body-html-pipeline';
import { SocialEmbedHtml, UserAvatar } from '@/shared/presentation';

import type { DiscussionCommentView } from '../../application/mappers/feed-story-from-api.mapper';
import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import type { PostDiscussionView } from '../../application/dto/post-discussion.dto';
import { viewerIsAuthor } from '../../domain/feed-item-kind';

import { useCommentEditTarget } from '../hooks/use-comment-edit-target';
import { StoryCommentEditor } from './story-comment-editor';
import { StoryInlineCommentEdit } from './story-inline-comment-edit';
import { StoryRewardBadge } from './story-reward-badge';
import { COMPACT_BODY_BLOCK_CLASSES } from './post-body-typography';
import { formatRelativeFeedTime } from './story-utils';
import { StoryVoteButton } from './story-vote-button';

type StoryCommentRowProps = {
  comment: DiscussionCommentView;
  discussion: PostDiscussionView;
  rootStory: FeedStoryView;
  currentUsername: string | null;
  depth?: number;
  onDiscussionRefresh: () => void;
};

export function StoryCommentRow({
  comment,
  discussion,
  rootStory,
  currentUsername,
  depth = 0,
  onDiscussionRefresh,
}: StoryCommentRowProps) {
  const { t, locale } = useI18n();
  const [replyOpen, setReplyOpen] = useState(false);
  const commentEdit = useCommentEditTarget(comment.authorName, comment.permlink);
  const isOwnComment = viewerIsAuthor(currentUsername, comment.authorName);
  const editing = isOwnComment && commentEdit.state.status !== 'idle';
  const childIds = discussion.childrenById[comment.id] ?? [];
  const displayAuthor = comment.authorDisplayName ?? comment.authorName;
  const profileHref = `/@${encodeURIComponent(comment.authorName)}`;

  return (
    <li className="list-none">
      <article
        className="rounded-btn border border-border bg-surface-control/60 p-3"
        style={{ marginLeft: depth > 0 ? `${Math.min(depth, 6) * 1.25}rem` : undefined }}
      >
        <header className="flex gap-2">
          <Link
            href={profileHref}
            suppressHydrationWarning
            className="shrink-0 rounded-circle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <UserAvatar
              username={comment.authorName}
              avatarUrl={comment.authorAvatarUrl}
              displayName={displayAuthor}
              size={32}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                href={profileHref}
                suppressHydrationWarning
                className="font-weight-label text-body-sm text-fg hover:underline"
              >
                {displayAuthor}
              </Link>
              <time className="text-caption text-fg-tertiary" dateTime={comment.createdAt}>
                {formatRelativeFeedTime(comment.createdAt, locale)}
              </time>
            </div>
            {editing && currentUsername ? (
              <StoryInlineCommentEdit
                state={commentEdit.state}
                story={rootStory}
                currentUsername={currentUsername}
                onClose={commentEdit.close}
                onSaved={() => {
                  commentEdit.close();
                  onDiscussionRefresh();
                }}
              />
            ) : (
              <SocialEmbedHtml
                className={`blog-post-body mt-1 min-w-0 break-words text-body-sm text-fg ${COMPACT_BODY_BLOCK_CLASSES}`}
                html={sanitizePostBodyHtml(comment.body)}
              />
            )}
          </div>
        </header>
        <footer className="relative z-20 mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StoryVoteButton
              authorName={comment.authorName}
              permlink={comment.permlink}
              votes={comment.votes}
              currentUsername={currentUsername}
            />
            {currentUsername ? (
            <button
              type="button"
              className="rounded-btn px-2 py-0.5 text-caption text-muted hover:bg-surface-control hover:text-fg-secondary"
              onClick={() => setReplyOpen((v) => !v)}
            >
              Reply
            </button>
            ) : null}
            {isOwnComment && !editing ? (
              <button
                type="button"
                className="rounded-btn px-2 py-0.5 text-caption text-muted hover:bg-surface-control hover:text-fg-secondary"
                onClick={() => {
                  setReplyOpen(false);
                  void commentEdit.open();
                }}
              >
                {t('edit')}
              </button>
            ) : null}
          </div>
          <StoryRewardBadge
            reward={comment.reward}
            waivRewardEligible={comment.waivRewardEligible ?? false}
            postAuthor={comment.authorName}
          />
        </footer>
        {replyOpen && currentUsername ? (
          <div className="mt-3 border-t border-border pt-3">
            <StoryCommentEditor
              story={rootStory}
              currentUsername={currentUsername}
              parentAuthor={comment.authorName}
              parentPermlink={comment.permlink}
              onSubmitted={() => {
                setReplyOpen(false);
                onDiscussionRefresh();
              }}
            />
          </div>
        ) : null}
      </article>
      {childIds.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {childIds.map((childId) => {
            const child = discussion.comments[childId];
            if (!child) {
              return null;
            }
            return (
              <StoryCommentRow
                key={childId}
                comment={child}
                discussion={discussion}
                rootStory={rootStory}
                currentUsername={currentUsername}
                depth={depth + 1}
                onDiscussionRefresh={onDiscussionRefresh}
              />
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
