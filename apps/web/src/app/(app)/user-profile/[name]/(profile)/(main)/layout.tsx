import type { ReactNode } from 'react';
import { Suspense } from 'react';

import {
  FixedRegion,
  FeedColumn,
} from '@/shared/presentation/layout';
import {
  FavoritesCategoryDrawer,
  FavoritesCategoryDrawerProvider,
  FavoritesFilterSheet,
  FavoritesFilterSheetProvider,
  FavoritesTypesMenu,
  FavoritesTypesMenuSkeleton,
  ProfileMainWalletModalShell,
  RightSidebar,
  UserMenuVerticalRail,
  UserProfileMainContentPendingShell,
  UserProfileSubmenu,
} from '@/modules/user-profile';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

type AccountParams = { params: Promise<{ name: string }> };

async function readAccountName(params: AccountParams['params']): Promise<string> {
  const { name } = await params;
  return decodeURIComponent(name);
}

async function ProfileMainRail({ params }: AccountParams) {
  return <UserMenuVerticalRail accountName={await readAccountName(params)} />;
}

/**
 * The Favorites types menu is rendered here (not in the Favorites page) so it stays mounted and
 * outside the pending overlay while a type or category loads, like the wallet tabs.
 */
async function ProfileMainSubmenu({ params }: AccountParams) {
  const accountName = await readAccountName(params);
  return (
    <UserProfileSubmenu
      accountName={accountName}
      favoritesTypesMenu={
        <Suspense fallback={<FavoritesTypesMenuSkeleton />}>
          <FavoritesTypesMenu accountName={accountName} />
        </Suspense>
      }
    />
  );
}

/** Mobile Favorites filter sheet (right rail facets); opened by the Filter button above the list. */
async function ProfileMainFavoritesFilterSheet({ params }: AccountParams) {
  return <FavoritesFilterSheet accountName={await readAccountName(params)} />;
}

async function ProfileMainRightSidebar({ params }: AccountParams) {
  const accountName = await readAccountName(params);
  const user = await createCookieAuthContextProvider().getUser();
  return <RightSidebar accountName={accountName} viewerUsername={user?.username ?? null} />;
}

/**
 * Profile `(main)` shell — parity with {@link ObjectViewShell}. The grid is static; the parts that
 * need the account name or the viewer stream into it, so the segment has a shell of its own.
 *
 * Below `lg` the left rail is hidden; on Favorites the same `leftSidebar` node (the category
 * nav) opens in `FavoritesCategoryDrawer` from the current breadcrumb, and the right rail's
 * facets open in `FavoritesFilterSheet` from the Filter button. Their open state lives here
 * because category and filter URLs re-render the page segment while they stay open.
 * @see apps/web/src/modules/object/presentation/components/object-view-shell.tsx
 */
export default function UserProfileMainShellLayout({
  children,
  leftSidebar,
  params,
}: {
  children: ReactNode;
  leftSidebar: ReactNode;
  params: Promise<{ name: string }>;
}) {
  return (
    <ProfileMainWalletModalShell>
    <FavoritesCategoryDrawerProvider>
    <FavoritesFilterSheetProvider>
    <div
      className={[
        'shell-profile-grid mt-card-padding grid grid-cols-1 gap-card-padding',
        'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
      ].join(' ')}
    >
      <div className="hidden min-w-0 lg:block">
        <div className="shell-profile-left-rail shell-hide-instagram lg:contents">
          <div className="shell-hide-twitter lg:contents">{leftSidebar}</div>
          <div className="shell-show-twitter">
            <FixedRegion>
              <Suspense fallback={null}>
                <ProfileMainRail params={params} />
              </Suspense>
            </FixedRegion>
          </div>
        </div>
      </div>

      <main className="min-h-[12rem] min-w-0">
        <FeedColumn>
          <Suspense fallback={null}>
            <ProfileMainSubmenu params={params} />
          </Suspense>
          <UserProfileMainContentPendingShell>
            {children}
          </UserProfileMainContentPendingShell>
        </FeedColumn>
      </main>

      <div className="hidden min-w-0 lg:block">
        <div className="shell-hide-instagram lg:contents">
          <Suspense fallback={null}>
            <ProfileMainRightSidebar params={params} />
          </Suspense>
        </div>
      </div>
    </div>
    <FavoritesCategoryDrawer>{leftSidebar}</FavoritesCategoryDrawer>
    <Suspense fallback={null}>
      <ProfileMainFavoritesFilterSheet params={params} />
    </Suspense>
    </FavoritesFilterSheetProvider>
    </FavoritesCategoryDrawerProvider>
    </ProfileMainWalletModalShell>
  );
}
