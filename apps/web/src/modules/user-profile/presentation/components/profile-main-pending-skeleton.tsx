'use client';

import { objectTypeSupportsCategories } from '@opden-data-layer/core/object-type-registry';

import { FeedPostsLoadingSkeleton } from '@/modules/feed/presentation/components/feed-posts-loading-skeleton';
import { FeedListSkeleton } from '@/modules/feed/presentation/components/feed-skeletons';
import { TransfersWalletLoadingSkeleton } from '@/modules/user-wallet/presentation/components/wallet/transfers-wallet-loading-skeleton';
import { FeedColumn } from '@/shared/presentation/layout';

import { parseFavoritesPath, type FavoritesPath } from '../../domain/favorites-path';
import {
  parseProfileShopFilters,
  profileShopFiltersActive,
} from '../../domain/profile-shop-filters-url';
import { FavoritesBreadcrumbs } from './favorites-breadcrumbs';
import { getSegmentsAfterAccount } from './profile-path';
import { getAccountFromPathname } from './user-profile-pending-nav';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { getSubmenuVariant } from './user-profile-subnav';

function ProfileSocialListPendingSkeleton() {
  return (
    <div
      className="min-w-0 pb-section-y"
      aria-busy="true"
      aria-label="Loading social list"
    >
      <ul className="divide-y divide-border" role="list">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <div className="size-12 shrink-0 animate-pulse rounded-circle bg-surface-control" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 max-w-[8rem] animate-pulse rounded-btn bg-surface-control" />
              <div className="h-3 max-w-[12rem] animate-pulse rounded-btn bg-surface-control" />
            </div>
            <div className="h-9 w-24 shrink-0 animate-pulse rounded-btn bg-surface-control" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileSectionPendingSkeleton() {
  return (
    <section
      className="rounded-card border border-border bg-surface/80 p-card-padding"
      aria-busy="true"
      aria-label="Loading section"
    >
      <div className="h-6 max-w-[12rem] animate-pulse rounded-btn bg-surface-control" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded-btn bg-surface-control" />
        <div className="h-4 max-w-[85%] animate-pulse rounded-btn bg-surface-control" />
        <div className="h-4 max-w-[70%] animate-pulse rounded-btn bg-surface-control" />
      </div>
    </section>
  );
}

const FAVORITES_PENDING_SECTION_COUNT = 2;

/** Same shell as a loaded section card (`FavoritesSections`): heading row inside the card. */
function FavoritesSectionsPendingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {Array.from({ length: FAVORITES_PENDING_SECTION_COUNT }, (_, section) => (
        <section
          key={section}
          className="rounded-card border border-border bg-surface/60 p-card-padding"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="h-6 max-w-[10rem] flex-1 animate-pulse rounded-btn bg-surface-control" />
            <div className="h-4 w-16 animate-pulse rounded-btn bg-surface-control" />
          </div>
          <div className="mt-4">
            <FeedListSkeleton count={2} />
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Favorites tab while the next location loads: breadcrumbs from the pending URL (instant), then
 * category sections for a category type without filters, or a flat object list otherwise.
 */
function ProfileFavoritesPendingSkeleton({
  pathname,
  search,
  favoritesPath,
}: {
  pathname: string;
  search: string;
  favoritesPath: FavoritesPath;
}) {
  const accountName = getAccountFromPathname(pathname);
  const filters = parseProfileShopFilters(new URLSearchParams(search));
  const { objectType, lineage, uncategorizedOnly } = favoritesPath;
  const showSections =
    objectType !== null &&
    objectTypeSupportsCategories(objectType) &&
    !uncategorizedOnly &&
    !profileShopFiltersActive(filters);

  return (
    <div aria-busy="true" aria-label="Loading favorites">
      {accountName && objectType ? (
        <FavoritesBreadcrumbs
          accountName={accountName}
          objectType={objectType}
          lineage={lineage}
          filters={filters}
        />
      ) : null}
      {showSections ? (
        <FavoritesSectionsPendingSkeleton />
      ) : (
        <FeedColumn>
          <FeedListSkeleton count={6} />
        </FeedColumn>
      )}
    </div>
  );
}

/** Client-safe pending overlay skeletons (no server route `loading.tsx` imports). */
export function ProfileMainPendingSkeleton() {
  const { pathname, search } = useEffectiveProfileNav();
  const variant = getSubmenuVariant(pathname);
  const head = getSegmentsAfterAccount(pathname)[0] ?? '';

  if (head === 'permissions') {
    return <ProfileSectionPendingSkeleton />;
  }
  if (variant === 'wallet') {
    return <TransfersWalletLoadingSkeleton />;
  }
  if (variant === 'feed') {
    return <FeedPostsLoadingSkeleton />;
  }
  if (variant === 'followers') {
    return <ProfileSocialListPendingSkeleton />;
  }
  if (variant === 'expertise') {
    return <ProfileSectionPendingSkeleton />;
  }

  const favoritesPath = parseFavoritesPath(pathname);
  if (favoritesPath) {
    return (
      <ProfileFavoritesPendingSkeleton
        pathname={pathname}
        search={search}
        favoritesPath={favoritesPath}
      />
    );
  }

  return <FeedPostsLoadingSkeleton />;
}
