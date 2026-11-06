import type { ReactNode } from 'react';
import { Suspense } from 'react';

import {
  FixedRegion,
  FeedColumn,
} from '@/shared/presentation/layout';
import {
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

async function ProfileMainSubmenu({ params }: AccountParams) {
  return <UserProfileSubmenu accountName={await readAccountName(params)} />;
}

async function ProfileMainRightSidebar({ params }: AccountParams) {
  const accountName = await readAccountName(params);
  const user = await createCookieAuthContextProvider().getUser();
  return <RightSidebar accountName={accountName} viewerUsername={user?.username ?? null} />;
}

/**
 * Profile `(main)` shell — parity with {@link ObjectViewShell}. The grid is static; the parts that
 * need the account name or the viewer stream into it, so the segment has a shell of its own.
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
    </ProfileMainWalletModalShell>
  );
}
