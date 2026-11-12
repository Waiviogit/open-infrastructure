'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CommentIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';
import { SocialEmbedHtml, StatHoverTooltip, UserAvatar } from '@/shared/presentation';

import type { FeedStoryView } from '../../application/dto/feed-story.dto';
import { isReplyFeedItem, viewerIsAuthor } from '../../domain/feed-item-kind';

import { formatRelativeFeedTime, formatReputation } from './story-utils';
import { StoryRewardBadge } from './story-reward-badge';
import { useLoginModal } from '@/modules/auth';

import { LinkedObjectsSection } from './linked-objects-section';
import {
  POST_BODY_BLOCK_CLASSES,
  POST_BODY_EDITORIAL_CLASSES,
  POST_MODAL_TITLE_CLASSES,
} from './post-body-typography';
import { StoryCommentsSection } from './story-comments-section';
import { StoryOverflowMenu } from './story-overflow-menu';
import { StoryReblogButton } from './story-reblog-button';
import { StoryStatButton } from './story-stat-button';
import { StoryVoteButton } from './story-vote-button';
import { StoryCommentEditor } from './story-comment-editor';

export type BlogPostScreenVariant = 'page' | 'modal';

type BlogPostScreenProps = {
  variant?: BlogPostScreenVariant;
  story: FeedStoryView;
  bodyHtmlSafe: string;
  currentUsername: string | null;
  /** Shown in place of the relative post time (e.g. "Preview" for an unpublished draft). */
  timeLabelOverride?: string;
};

export function BlogPostScreen({
  variant = 'page',
  story,
  bodyHtmlSafe,
  currentUsername,
  timeLabelOverride,
}: BlogPostScreenProps) {
  const { t, locale } = useI18n();
  const displayAuthor = story.authorDisplayName ?? story.authorName;
  const displayTimeIso = story.feedAt ?? story.createdAt;
  const relativeLabel = formatRelativeFeedTime(displayTimeIso, locale);
  const repLabel = formatReputation(story.authorWobjectsWeight, locale);
  const { openLogin } = useLoginModal();
  const taggedObjects = story.objects ?? [];
  const isOwnPost = viewerIsAuthor(currentUsername, story.authorName);
  const editorSearch = new URLSearchParams({
    author: story.authorName,
    permlink: story.permlink,
  });
  /** `/editor` edits root posts only; a comment opened at its permalink has no "Edit post". */
  const editHref = isReplyFeedItem(story.parentAuthor, undefined)
    ? null
    : `/editor?${editorSearch.toString()}`;
  const authorProfileHref = `/@${encodeURIComponent(story.authorName)}`;

  const isModal = variant === 'modal';
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  const shellClass = isModal
    ? 'border-0 bg-transparent p-0 shadow-none'
    : 'rounded-card border border-border bg-surface/80 p-card-padding shadow-whisper';

  return (
    <article
      className={shellClass}
      aria-labelledby={`post-title-${story.id}`}
      data-blog-post-variant={variant}
    >
      {story.rebloggedBy ? (
        <p className="mb-3 rounded-btn bg-surface-control px-2 py-1 text-caption text-muted">
          Reblogged by{' '}
          <span className="font-weight-label text-fg-secondary">@{story.rebloggedBy}</span>
        </p>
      ) : null}

      <div className="min-w-0">
        {/* Title */}
        {story.title ? (
          <h1
            id={`post-title-${story.id}`}
            className={
              isModal ? POST_MODAL_TITLE_CLASSES : 'text-display font-display text-heading'
            }
          >
            {story.title}
          </h1>
        ) : (
          <h1 id={`post-title-${story.id}`} className="sr-only">
            Post by {displayAuthor}
          </h1>
        )}

        {/* Comment count — accent link, shown below title in modal */}
        {isModal && story.children != null && story.children > 0 ? (
          <p className="mt-1.5 text-body-sm font-weight-label text-accent">
            {story.children} {story.children === 1 ? 'comment' : 'comments'}
          </p>
        ) : null}

        {/* Author row */}
        <header className="mt-4 flex gap-3">
          <Link
            href={authorProfileHref}
            suppressHydrationWarning
            className="inline-flex shrink-0 self-start rounded-circle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label={`View profile: @${story.authorName}`}
          >
            <UserAvatar
              username={story.authorName}
              avatarUrl={story.authorAvatarUrl}
              displayName={displayAuthor}
              size={40}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                href={authorProfileHref}
                suppressHydrationWarning
                className="font-weight-label text-body-sm text-fg hover:underline focus-visible:rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {displayAuthor}
              </Link>
              {repLabel != null ? (
                <StatHoverTooltip content={t('stat_user_expertise_tooltip')}>
                  <span className="rounded-btn bg-surface-control px-1.5 py-0.5 text-caption font-weight-label text-fg-secondary tabular-nums">
                    {repLabel}
                  </span>
                </StatHoverTooltip>
              ) : null}
              <span className="text-caption text-muted">·</span>
              {timeLabelOverride ? (
                <span className="text-caption text-fg-tertiary">{timeLabelOverride}</span>
              ) : (
                <time className="text-caption text-fg-tertiary" dateTime={displayTimeIso}>
                  {relativeLabel}
                </time>
              )}
              {story.category ? (
                <>
                  <span className="text-caption text-muted">·</span>
                  <span className="text-caption text-fg-tertiary">{story.category}</span>
                </>
              ) : null}
            </div>
          </div>
          {!isModal ? (
            <StoryOverflowMenu
              authorName={story.authorName}
              editHref={editHref}
              currentUsername={currentUsername}
              isOwnPost={isOwnPost}
            />
          ) : null}
        </header>

        {/* Body — video/thumbnails for full post come from sanitized HTML (YouTube URLs → embeds). Feed cards use Story. */}
        {/* suppressHydrationWarning: browser may normalize serialized HTML vs prop string; extensions may touch the subtree. */}
        <SocialEmbedHtml
          html={bodyHtmlSafe}
          className={[
            'blog-post-body min-w-0 text-fg leading-body',
            isModal ? `mt-5 ${POST_BODY_EDITORIAL_CLASSES}` : 'mt-6 text-body',
            POST_BODY_BLOCK_CLASSES,
            '[&_img]:h-auto [&_img]:max-w-full [&_img]:my-3',
            '[&_p]:empty:hidden',
            '[&_br]:block [&_br]:content-[""] [&_br]:mt-3',
            '[&_pre]:overflow-x-auto [&_pre]:bg-code-bg [&_pre]:p-3',
          ].join(' ')}
        />

        <LinkedObjectsSection
          objects={taggedObjects}
          objectLinkReplace={isModal}
          viewerUsername={currentUsername}
          onRequireLogin={openLogin}
        />

        {story.isNsfw ? (
          <p className="mt-2 text-caption text-muted" role="status">
            NSFW
          </p>
        ) : null}
      </div>

      <footer className={`relative z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 ${isModal ? 'mt-6' : 'mt-4'}`}>
        <div className="flex flex-wrap items-center gap-1">
          <StoryVoteButton
            authorName={story.authorName}
            permlink={story.permlink}
            votes={story.votes}
            currentUsername={currentUsername}
          />
          <StoryStatButton
            icon={<CommentIcon size={20} />}
            count={
              (story.children ?? 0) > 0 ? story.children : undefined
            }
            label="Comments"
            iconHoverAccent
            ariaPressed={commentsExpanded}
            onClick={() => setCommentsExpanded((v) => !v)}
          />
          <StoryReblogButton
            authorName={story.authorName}
            permlink={story.permlink}
            rebloggedByViewer={story.rebloggedByViewer ?? false}
            currentUsername={currentUsername}
            isOwnPost={isOwnPost}
          />
          {isModal ? (
            <StoryOverflowMenu
              authorName={story.authorName}
              editHref={editHref}
              currentUsername={currentUsername}
              isOwnPost={isOwnPost}
            />
          ) : null}
        </div>
        <StoryRewardBadge
          reward={story.reward}
          waivRewardEligible={story.waivRewardEligible ?? false}
          postAuthor={story.authorName}
        />
      </footer>
      {commentsExpanded ? (
        <>
          <StoryCommentsSection
            story={story}
            currentUsername={currentUsername}
            expanded
            layout="full"
          />
          {currentUsername ? (
            <StoryCommentEditor story={story} currentUsername={currentUsername} />
          ) : null}
        </>
      ) : null}
    </article>
  );
}
