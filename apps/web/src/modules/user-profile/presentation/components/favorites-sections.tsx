'use client';

import { useCallback, useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';
import { CategorySectionCard } from '@/modules/feed/presentation';
import { useInfiniteScroll, useSyncedPaginatedList } from '@/shared/presentation';
import { FeedColumn } from '@/shared/presentation/layout';

import { loadMoreFavoritesSectionsAction } from '@/app/(app)/user-profile/[name]/favorites-feed.actions';

import { buildFavoritesPath } from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import type { ShopSectionView, ShopSectionsPage } from '../../domain/types/shop-objects';
import { UNCATEGORIZED_SHOP_PATH_SEGMENT } from '../../domain/category-nav-path';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { FavoritesLoadMoreFooter } from './favorites-load-more-footer';
import { FavoritesNavLink } from './favorites-nav-links';

/** Objects with no category; rendered after the last category section on the type root. */
export type FavoritesUncategorizedSection = Pick<ShopSectionView, 'items' | 'totalObjects'>;

export type FavoritesSectionsProps = {
  accountName: string;
  objectType: string;
  initialSections: ShopSectionsPage;
  /** Lineage to the current nav node (decoded URL segments). */
  lineageSegments: readonly string[];
  /** Category API drill-down: parent department (undefined at the type root). */
  navName?: string;
  /** Ancestors before `navName`. */
  navPath: readonly string[];
  /** Shown once every category section is loaded (type root only). */
  uncategorizedSection?: FavoritesUncategorizedSection | null;
  shopFilters: ProfileShopFiltersState;
  viewerUsername?: string | null;
};

/**
 * Child categories of the current node of a category type, each a `CategorySectionCard` (preview
 * objects, count, Show more). More sections load on scroll; the Uncategorized section closes the
 * type root.
 */
export function FavoritesSections({
  accountName,
  objectType,
  initialSections,
  lineageSegments,
  navName,
  navPath,
  uncategorizedSection = null,
  shopFilters,
  viewerUsername,
}: FavoritesSectionsProps) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const {
    items: sections,
    setItems: setSections,
    cursor,
    setCursor,
    hasMore,
    setHasMore,
  } = useSyncedPaginatedList({
    items: initialSections.sections,
    cursor: initialSections.cursor,
    hasMore: initialSections.hasMore,
  });
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  const onLoadMore = useCallback(() => {
    if (!hasMore || !cursor || pending) {
      return;
    }
    setLoadError(false);
    startTransition(async () => {
      try {
        const result = await loadMoreFavoritesSectionsAction(accountName, {
          objectType,
          navName,
          navPath: [...navPath],
          tags: shopFilters.tags,
          rating: shopFilters.rating,
          cursor,
        });
        if (!result.ok) {
          setLoadError(true);
          return;
        }
        setSections((prev) => {
          const seen = new Set(prev.map((section) => section.categoryName));
          return [
            ...prev,
            ...result.value.sections.filter((section) => !seen.has(section.categoryName)),
          ];
        });
        setCursor(result.value.cursor);
        setHasMore(result.value.hasMore);
      } catch {
        setLoadError(true);
      }
    });
  }, [
    accountName,
    cursor,
    hasMore,
    navName,
    navPath,
    objectType,
    pending,
    setCursor,
    setHasMore,
    setSections,
    shopFilters.rating,
    shopFilters.tags,
  ]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore: hasMore && !loadError,
    isLoading: pending,
    onLoadMore,
  });

  const trailingUncategorized = hasMore ? null : uncategorizedSection;

  if (sections.length === 0 && trailingUncategorized === null) {
    return (
      <section
        className="rounded-card border border-border bg-surface/80 p-card-padding"
        aria-labelledby="favorites-sections-empty"
      >
        <h2
          id="favorites-sections-empty"
          className="text-body-lg font-weight-strong font-display text-fg"
        >
          {formatFavoritesTypeLabel(objectType)}
        </h2>
        <p className="mt-2 text-body-sm text-muted">{t('profile_shop_sections_empty')}</p>
      </section>
    );
  }

  return (
    <FeedColumn>
      <div className="flex flex-col gap-8">
        {sections.map((sec, index) => (
          <CategorySectionCard
            key={sec.categoryName}
            headingId={`favorites-section-${index}`}
            title={sec.categoryName}
            href={buildProfileShopHref(
              buildFavoritesPath(accountName, objectType, [...lineageSegments, sec.categoryName]),
              shopFilters,
            )}
            totalObjects={sec.totalObjects}
            items={sec.items}
            NavLink={FavoritesNavLink}
            viewerUsername={viewerUsername}
            onRequireLogin={openLogin}
          />
        ))}
        {trailingUncategorized ? (
          <CategorySectionCard
            headingId="favorites-section-uncategorized"
            title={t('profile_categories_uncategorized')}
            href={buildProfileShopHref(
              buildFavoritesPath(accountName, objectType, [UNCATEGORIZED_SHOP_PATH_SEGMENT]),
              shopFilters,
            )}
            totalObjects={trailingUncategorized.totalObjects}
            items={trailingUncategorized.items}
            NavLink={FavoritesNavLink}
            viewerUsername={viewerUsername}
            onRequireLogin={openLogin}
          />
        ) : null}
      </div>
      <FavoritesLoadMoreFooter
        hasMore={hasMore}
        pending={pending}
        loadError={loadError}
        sentinelRef={sentinelRef}
        onLoadMore={onLoadMore}
        loadMoreLabel={t('profile_shop_load_more_sections')}
      />
    </FeedColumn>
  );
}
