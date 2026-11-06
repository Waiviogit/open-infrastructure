'use client';

import { UPDATE_REGISTRY } from '@opden-data-layer/core/update-registry';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';
import { objectFields } from '@/modules/feed/application/dto/object-fields';
import { ObjectPageLink } from '@/modules/feed/presentation';
import { UpdateCard } from '@/modules/object-updates/presentation/components/update-card';
import { ObjectThumbnail } from '@/shared/presentation';
import { FeedColumn } from '@/shared/presentation/layout';
import { objectPagePath } from '@/shared/routes/object-page-path';

import { loadMoreHomeUpdatesFeedAction } from '@/app/(app)/(hub)/(home)/home-feed.actions';

import type {
  HomeUpdateFeedItemView,
  HomeUpdatesFeedPage,
} from '../../application/dto/home-followed-feeds.dto';
import { useHomeFeedPages } from '../hooks/use-home-feed-pages';
import { HomeFeedEmptyState } from './home-feed-empty-state';
import { HomeFeedLoadMore } from './home-feed-load-more';

const OBJECT_AVATAR_SIZE = 28;

type HomeUpdatesFeedListProps = {
  initialPage: HomeUpdatesFeedPage;
  currentUsername: string;
};

function UpdateObjectHeader({ item }: { item: HomeUpdateFeedItemView }) {
  const name = (item.object && objectFields.name(item.object)) || item.object_id;
  const image = item.object ? objectFields.image(item.object) : undefined;

  return (
    <ObjectPageLink
      href={objectPagePath(item.object_id)}
      className="mb-2 flex min-w-0 items-center gap-2 text-body-sm font-weight-strong text-fg hover:text-link"
    >
      <ObjectThumbnail src={image} size={OBJECT_AVATAR_SIZE} className="shrink-0 rounded-btn" />
      <span className="truncate">{name}</span>
    </ObjectPageLink>
  );
}

export function HomeUpdatesFeedList({ initialPage, currentUsername }: HomeUpdatesFeedListProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const { items, hasMore, pending, canLoadMore, onLoadMore, sentinelRef } = useHomeFeedPages(
    initialPage,
    loadMoreHomeUpdatesFeedAction,
  );

  if (items.length === 0) {
    return <HomeFeedEmptyState message={t('home_feed_updates_empty')} />;
  }

  return (
    <FeedColumn>
      <ul className="flex flex-col gap-card-padding">
        {items.map((item) => (
          <li key={item.update_id} className="list-none">
            <UpdateObjectHeader item={item} />
            <UpdateCard
              item={item}
              showLocaleBadge={UPDATE_REGISTRY[item.update_type]?.localizable === true}
              viewerUsername={currentUsername}
              onRequireLogin={openLogin}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <HomeFeedLoadMore
          sentinelRef={sentinelRef}
          pending={pending}
          canLoadMore={canLoadMore}
          onLoadMore={onLoadMore}
        />
      ) : null}
    </FeedColumn>
  );
}
