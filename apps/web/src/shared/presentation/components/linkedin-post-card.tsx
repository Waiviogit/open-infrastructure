'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CommentIcon, ExternalLinkIcon, ThumbUpIcon } from '@/icons';
import { getImagePathPost } from '@/shared/infrastructure/image/get-proxy-image-url';
import type {
  LinkedInPostCard,
  LinkedInPostMedia,
} from '@/shared/infrastructure/linkedin-post-card';

const EXTERNAL_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;
/** Image grid tiles; the last one shows how many more images the post has. */
const MAX_GRID_IMAGES = 4;
const STAT_ICON_SIZE = 14;

function joinClasses(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function AuthorAvatar({ name, url }: { name: string; url: string | null }) {
  if (!url) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-circle bg-surface-control text-body-sm font-weight-strong text-fg-secondary"
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={getImagePathPost(url)}
      alt=""
      className="size-10 shrink-0 rounded-circle object-cover"
      loading="lazy"
      decoding="async"
    />
  );
}

function ImagesMedia({
  images,
  permalink,
}: {
  images: Extract<LinkedInPostMedia, { kind: 'images' }>['images'];
  permalink: string;
}) {
  if (images.length === 1) {
    const [image] = images;
    return (
      <a href={permalink} {...EXTERNAL_LINK} className="block">
        <img
          src={getImagePathPost(image.url)}
          alt={image.alt}
          className="block max-h-[540px] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </a>
    );
  }
  const shown = images.slice(0, MAX_GRID_IMAGES);
  const hiddenCount = images.length - shown.length;
  return (
    <a href={permalink} {...EXTERNAL_LINK} className="grid grid-cols-2 gap-0.5">
      {shown.map((image, index) => (
        <span
          key={image.url}
          className="relative block aspect-square overflow-hidden"
        >
          <img
            src={getImagePathPost(image.url)}
            alt={image.alt}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {hiddenCount > 0 && index === shown.length - 1 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-overlay/60 text-body-lg font-weight-strong text-accent-fg">
              +{hiddenCount}
            </span>
          ) : null}
        </span>
      ))}
    </a>
  );
}

function PostMedia({
  media,
  permalink,
}: {
  media: LinkedInPostMedia;
  permalink: string;
}) {
  switch (media.kind) {
    case 'images':
      return <ImagesMedia images={media.images} permalink={permalink} />;
    case 'article':
      return (
        <a
          href={media.url}
          {...EXTERNAL_LINK}
          className="block border-y border-border bg-surface"
        >
          {media.imageUrl ? (
            <img
              src={getImagePathPost(media.imageUrl)}
              alt=""
              className="block aspect-[1.91/1] w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span className="block px-card-padding py-2">
            <span className="line-clamp-2 block text-body-sm font-weight-strong text-heading">
              {media.title}
            </span>
            {media.subtitle ? (
              <span className="block truncate text-caption text-muted">
                {media.subtitle}
              </span>
            ) : null}
          </span>
        </a>
      );
    case 'video':
      return (
        <video
          controls
          playsInline
          preload="none"
          poster={
            media.posterUrl ? getImagePathPost(media.posterUrl) : undefined
          }
          className="block max-h-[70vh] w-full bg-black"
          style={
            media.aspectRatio ? { aspectRatio: media.aspectRatio } : undefined
          }
        >
          {media.sources.map((src) => (
            <source key={src} src={src} type="video/mp4" />
          ))}
        </video>
      );
    case 'none':
    default:
      return null;
  }
}

function Stat({ icon, count }: { icon: ReactNode; count: number | null }) {
  if (count === null) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {count}
    </span>
  );
}

export type LinkedInPostCardViewProps = {
  card: LinkedInPostCard;
  className?: string;
};

/** LinkedIn post rendered from its embed page data: grows with its content, follows the theme. */
export function LinkedInPostCardView({
  card,
  className,
}: LinkedInPostCardViewProps) {
  const { t } = useI18n();
  const { author } = card;
  const authorName = author.profileUrl ? (
    <a
      href={author.profileUrl}
      {...EXTERNAL_LINK}
      className="truncate text-body-sm font-weight-strong text-heading hover:underline"
    >
      {author.name}
    </a>
  ) : (
    <span className="truncate text-body-sm font-weight-strong text-heading">
      {author.name}
    </span>
  );

  return (
    <article
      className={joinClasses(
        'mx-auto w-full max-w-[540px] overflow-hidden rounded-btn border border-border bg-bg text-fg',
        className,
      )}
    >
      {card.activityHeader ? (
        <p className="border-b border-border px-card-padding py-2 text-caption text-muted">
          {card.activityHeader}
        </p>
      ) : null}
      <header className="flex items-center gap-2 px-card-padding pt-3">
        {author.profileUrl ? (
          <a
            href={author.profileUrl}
            {...EXTERNAL_LINK}
            className="shrink-0"
            tabIndex={-1}
          >
            <AuthorAvatar name={author.name} url={author.avatarUrl} />
          </a>
        ) : (
          <AuthorAvatar name={author.name} url={author.avatarUrl} />
        )}
        <span className="flex min-w-0 flex-col">
          {authorName}
          {author.headline ? (
            <span className="truncate text-caption text-muted">
              {author.headline}
            </span>
          ) : null}
        </span>
      </header>
      {card.commentary ? (
        <p className="whitespace-pre-wrap break-words px-card-padding pt-2 text-body-sm">
          {card.commentary}
        </p>
      ) : null}
      <div className="mt-3">
        <PostMedia media={card.media} permalink={card.permalink} />
      </div>
      <footer className="flex items-center gap-4 border-t border-border px-card-padding py-2 text-caption text-muted">
        <Stat
          icon={<ThumbUpIcon size={STAT_ICON_SIZE} />}
          count={card.reactionCount}
        />
        <Stat
          icon={<CommentIcon size={STAT_ICON_SIZE} />}
          count={card.commentCount}
        />
        <a
          href={card.permalink}
          {...EXTERNAL_LINK}
          className="ml-auto inline-flex items-center gap-1 text-link hover:underline"
        >
          {t('linkedin_post_open')}
          <ExternalLinkIcon size={STAT_ICON_SIZE} />
        </a>
      </footer>
    </article>
  );
}
