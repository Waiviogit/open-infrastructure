import { Suspense } from 'react';

import type { UserProfileShellUser } from '../../domain/types/user-profile-shell-user';
import { ProfilePageBodySkeleton } from './profile-content-skeletons';
import { ProfileHeroSkeleton } from './profile-hero-skeleton';
import { UserProfileHeroClient } from './user-profile-hero-client';
import { UserProfilePendingNavRoot } from './user-profile-pending-nav-root';
import { UserProfileSocialCountsProvider } from './user-profile-social-counts-context';

export type ProfileHeadShellProps = {
  accountName: string;
  head: UserProfileShellUser;
};

/**
 * Profile page while the viewer and the full profile load: the real hero painted from the profile
 * head (`pending`: no follow / edit / guest controls, reputation as a placeholder) with the real
 * primary tabs, and skeletons for the rail and the feed. The loaded page renders the same hero.
 * Server component (the body skeleton pulls feed skeletons); used as a `<Suspense>` fallback.
 */
export function ProfileHeadShell({ accountName, head }: ProfileHeadShellProps) {
  return (
    <div className="contents" data-testid="profile-head-shell">
      <UserProfileSocialCountsProvider
        value={{ followerCount: head.followerCount, followingCount: head.followingCount }}
      >
        <UserProfilePendingNavRoot>
          {/* The hero reads search params (tab links); its own fallback keeps the geometry. */}
          <Suspense fallback={<ProfileHeroSkeleton />}>
            <UserProfileHeroClient
              pending
              accountName={accountName}
              initialUser={head}
              sidebar={null}
              viewerUsername={null}
            />
          </Suspense>
          <div aria-busy="true" aria-label="Loading profile posts">
            <ProfilePageBodySkeleton />
          </div>
        </UserProfilePendingNavRoot>
      </UserProfileSocialCountsProvider>
    </div>
  );
}
