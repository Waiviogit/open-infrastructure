'use client';

import { useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { IconName } from '@/icons';
import { formatObjectTypeLabel } from '@/modules/app-header/domain/search-nav-list';
import { useLoginModal } from '@/modules/auth';
import { iconForDiscoverObjectType } from '@/modules/discover/domain/discover-type-icons';
import { objectFields, type ProjectedObjectView } from '@/modules/feed/application/dto/object-fields';
import { ObjectThumbnail, UserAvatar, useEffectiveNav } from '@/shared/presentation';

import {
  loadMoreHomeFeedFilterObjectsAction,
  loadMoreHomeFeedFilterUsersAction,
} from '@/app/(app)/(hub)/(home)/home-feed.actions';

import type {
  HomeFeedFilterObject,
  HomeFeedFiltersView,
  HomeFeedFilterTypeView,
  HomeFeedFilterUser,
} from '../../../application/dto/home-feed-filters.dto';
import {
  HOME_FEED_TAB_SORTS,
  buildHomeFeedHref,
  isSameHomeFeedFilter,
  parseHomeFeedFilter,
  resolveHomeFeedFilter,
  type HomeFeedFilter,
  type HomeFeedSort,
} from '../../../domain/home-feed-filter';
import { HOME_FEED_TABS, type HomeFeedTabKey } from '../../../domain/home-feed-tabs';
import {
  HomeFeedFilterCount,
  HomeFeedFilterLink,
  HomeFeedFilterSection,
  HomeFeedFilterShowMore,
  HomeFeedFilterUnavailable,
} from './home-feed-filter-rows';

const ROW_AVATAR_SIZE = 20;

const SORTS: readonly { sort: HomeFeedSort; icon: IconName; labelKey: string }[] = [
  { sort: 'trending', icon: 'trending-up', labelKey: 'home_feed_filter_trending' },
  { sort: 'hot', icon: 'zap', labelKey: 'home_feed_filter_hot' },
  { sort: 'new', icon: 'clock', labelKey: 'home_feed_filter_new' },
];

export type HomeFeedFiltersPanelProps = {
  tab: HomeFeedTabKey;
  signedIn: boolean;
  /** Followed accounts / objects with counters; `null` for guests or when unavailable. */
  summary: HomeFeedFiltersView | null;
};

function objectName(item: HomeFeedFilterObject): string {
  const projected = item.object as ProjectedObjectView | null;
  return (projected && objectFields.name(projected)) || item.objectId;
}

function objectImage(item: HomeFeedFilterObject): string | undefined {
  const projected = item.object as ProjectedObjectView | null;
  return projected ? objectFields.image(projected) : undefined;
}

/**
 * Hub left rail: exactly one active filter for every tab. Sorts and My feed first, then
 * followed accounts and followed objects by type with "new in 3 days" counters.
 */
export function HomeFeedFiltersPanel({ tab, signedIn, summary }: HomeFeedFiltersPanelProps) {
  const { t } = useI18n();
  const { search } = useEffectiveNav();
  const { effective } = resolveHomeFeedFilter(
    tab,
    parseHomeFeedFilter(new URLSearchParams(search)),
    signedIn,
  );
  const tabHref = HOME_FEED_TABS.find((entry) => entry.key === tab)?.href ?? '/';
  const hrefFor = (filter: HomeFeedFilter | null) => buildHomeFeedHref(tabHref, filter);
  const isActive = (filter: HomeFeedFilter) => isSameHomeFeedFilter(filter, effective);

  return (
    <nav aria-label={t('home_feed_filters_aria')} className="flex min-w-0 flex-col gap-card-padding p-2">
      <div className="flex flex-col gap-0.5">
        {SORTS.map(({ sort, icon, labelKey }) =>
          HOME_FEED_TAB_SORTS[tab].includes(sort) ? (
            <HomeFeedFilterLink
              key={sort}
              href={hrefFor({ kind: sort })}
              active={isActive({ kind: sort })}
              icon={icon}
            >
              {t(labelKey)}
            </HomeFeedFilterLink>
          ) : (
            <HomeFeedFilterUnavailable key={sort} icon={icon} reason={t('home_feed_filter_unavailable_on_tab')}>
              {t(labelKey)}
            </HomeFeedFilterUnavailable>
          ),
        )}
        {signedIn ? (
          <HomeFeedFilterLink href={hrefFor(null)} active={isActive({ kind: 'my' })} icon="rss">
            {t('home_feed_filter_my_feed')}
          </HomeFeedFilterLink>
        ) : null}
      </div>

      {signedIn ? (
        summary ? (
          <HomeFeedFollowSections tab={tab} summary={summary} hrefFor={hrefFor} isActive={isActive} />
        ) : null
      ) : (
        <HomeFeedFiltersGuestPrompt />
      )}
    </nav>
  );
}

type FollowSectionsProps = {
  tab: HomeFeedTabKey;
  summary: HomeFeedFiltersView;
  hrefFor: (filter: HomeFeedFilter | null) => string;
  isActive: (filter: HomeFeedFilter) => boolean;
};

function HomeFeedFollowSections({ tab, summary, hrefFor, isActive }: FollowSectionsProps) {
  const { t } = useI18n();
  if (summary.users.total === 0 && summary.objectTypes.length === 0) {
    return <p className="px-2 text-caption text-muted">{t('home_feed_filters_follow_hint')}</p>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {summary.countsAvailable ? (
        <p className="px-2 text-caption text-muted">{t('home_feed_filters_window')}</p>
      ) : null}
      {summary.users.total > 0 ? (
        <HomeFeedPeopleSection tab={tab} summary={summary} hrefFor={hrefFor} isActive={isActive} />
      ) : null}
      {summary.objectTypes.map((type) => (
        <HomeFeedObjectTypeSection
          key={type.objectType}
          tab={tab}
          type={type}
          hrefFor={hrefFor}
          isActive={isActive}
        />
      ))}
    </div>
  );
}

function countLabel(t: (key: string) => string, count: number | null): string {
  return t('home_feed_filter_count_aria').replace('{count}', String(count ?? 0));
}

function HomeFeedPeopleSection({ tab, summary, hrefFor, isActive }: FollowSectionsProps) {
  const { t } = useI18n();
  const [users, setUsers] = useState<HomeFeedFilterUser[]>(summary.users.items);
  const [hasMore, setHasMore] = useState(summary.users.hasMore);
  const [collapsed, setCollapsed] = useState(!(summary.users.items[0]?.count ?? 0));
  const [pending, startTransition] = useTransition();

  const showMore = () =>
    startTransition(async () => {
      const page = await loadMoreHomeFeedFilterUsersAction(tab, users.length);
      setUsers((prev) => [...prev, ...page.items.filter((u) => !prev.some((p) => p.name === u.name))]);
      setHasMore(page.hasMore);
    });

  const title = t('home_feed_filter_section_people');
  return (
    <HomeFeedFilterSection
      id="home-feed-filter-people"
      title={title}
      icon="users"
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
      toggleLabel={t('home_feed_filter_type_toggle').replace('{type}', title)}
    >
      {users.map((user) => {
        const filter: HomeFeedFilter = { kind: 'author', account: user.name };
        return (
          <HomeFeedFilterLink
            key={user.name}
            href={hrefFor(filter)}
            active={isActive(filter)}
            title={`@${user.name}`}
            leading={
              <UserAvatar
                username={user.name}
                avatarUrl={user.avatarUrl}
                size={ROW_AVATAR_SIZE}
                className="shrink-0"
              />
            }
            trailing={<HomeFeedFilterCount count={user.count} label={countLabel(t, user.count)} />}
          >
            {user.name}
          </HomeFeedFilterLink>
        );
      })}
      {hasMore ? (
        <HomeFeedFilterShowMore pending={pending} onClick={showMore} label={t('home_feed_filter_show_more')} />
      ) : null}
    </HomeFeedFilterSection>
  );
}

type ObjectTypeSectionProps = Omit<FollowSectionsProps, 'summary'> & { type: HomeFeedFilterTypeView };

function HomeFeedObjectTypeSection({ tab, type, hrefFor, isActive }: ObjectTypeSectionProps) {
  const { t } = useI18n();
  const [objects, setObjects] = useState<HomeFeedFilterObject[]>(type.objects.items);
  const [hasMore, setHasMore] = useState(type.objects.hasMore);
  const [collapsed, setCollapsed] = useState(!(type.objects.items[0]?.count ?? 0));
  const [pending, startTransition] = useTransition();

  const showMore = () =>
    startTransition(async () => {
      const page = await loadMoreHomeFeedFilterObjectsAction(tab, type.objectType, objects.length);
      setObjects((prev) => [
        ...prev,
        ...page.items.filter((o) => !prev.some((p) => p.objectId === o.objectId)),
      ]);
      setHasMore(page.hasMore);
    });

  const title = formatObjectTypeLabel(type.objectType);
  return (
    <HomeFeedFilterSection
      id={`home-feed-filter-type-${type.objectType}`}
      title={title}
      icon={iconForDiscoverObjectType(type.objectType)}
      count={<HomeFeedFilterCount count={type.count} label={countLabel(t, type.count)} />}
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
      toggleLabel={t('home_feed_filter_type_toggle').replace('{type}', title)}
    >
      {objects.map((item) => {
        const filter: HomeFeedFilter = { kind: 'object', objectId: item.objectId };
        const name = objectName(item);
        return (
          <HomeFeedFilterLink
            key={item.objectId}
            href={hrefFor(filter)}
            active={isActive(filter)}
            title={name}
            leading={
              <ObjectThumbnail
                src={objectImage(item)}
                size={ROW_AVATAR_SIZE}
                className="shrink-0 rounded-btn"
              />
            }
            trailing={<HomeFeedFilterCount count={item.count} label={countLabel(t, item.count)} />}
          >
            {name}
          </HomeFeedFilterLink>
        );
      })}
      {hasMore ? (
        <HomeFeedFilterShowMore pending={pending} onClick={showMore} label={t('home_feed_filter_show_more')} />
      ) : null}
    </HomeFeedFilterSection>
  );
}

function HomeFeedFiltersGuestPrompt() {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-card-padding">
      <p className="text-body-sm text-fg-secondary">{t('home_feed_filters_guest_body')}</p>
      <button
        type="button"
        className="self-start rounded-btn bg-accent px-3 py-1.5 text-body-sm font-weight-label text-accent-fg hover:opacity-90"
        onClick={() => openLogin()}
      >
        {t('home_feed_filters_sign_in')}
      </button>
    </div>
  );
}
