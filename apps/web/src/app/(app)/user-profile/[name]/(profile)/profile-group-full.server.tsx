import { navigation } from 'next/cache';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import {
  getUserAccountSidebarQuery,
  getUserProfileQuery,
  UserProfileHeroClient,
  UserProfilePendingNavRoot,
  UserProfilePendingNavSync,
  UserProfileSocialCountsProvider,
} from '@/modules/user-profile';
import { getUserFeedUnreadCountsQuery } from '@/modules/user-profile/application/queries/get-user-feed-unread-counts.query';
import { ProfileFeedTabMarkReadEffect } from '@/modules/user-profile/presentation/components/profile-feed-tab-mark-read';
import { UserProfileFeedUnreadProvider } from '@/modules/user-profile/presentation/components/user-profile-feed-unread-context';
import { fetchExpertiseCountsForProfile } from '@/modules/user-profile/presentation/components/profile-expertise-main-content';
import { getUserFollowingObjectsPageQuery } from '@/modules/user-social';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';
import { ShellFullBleedBand, ShellInset } from '@/shared/presentation/layout';

import { getMockProfileShellUser } from '../mock-profile';

export type ProfileGroupFullProps = {
  accountName: string;
  children: React.ReactNode;
};

/**
 * The loaded profile (viewer, follow state, counters, tabs content) behind the head shell.
 * `navigation()` keeps it out of link prefetches: a hovered link prefetches only the head.
 * The account sidebar (live chain reads) is not awaited: the hero streams its reputation and
 * mobile meta.
 */
export async function ProfileGroupFull({ accountName, children }: ProfileGroupFullProps) {
  await navigation();
  const auth = createCookieAuthContextProvider();
  const viewerUser = await auth.getUser();
  const viewer = viewerUser?.username ?? null;

  const sidebar = getUserAccountSidebarQuery(accountName);
  const [profileResult, objectsHead, expertiseCounts, feedUnreadCounts] = await Promise.all([
    getUserProfileQuery(accountName, viewer),
    getUserFollowingObjectsPageQuery(accountName, { sort: 'weight', skip: 0, limit: 0 }),
    fetchExpertiseCountsForProfile(accountName),
    getUserFeedUnreadCountsQuery(accountName, viewer),
  ]);
  const profile = profileResult ?? getMockProfileShellUser(accountName);
  if (!profile) {
    notFound();
  }

  return (
    <UserProfileFeedUnreadProvider value={feedUnreadCounts}>
      <UserProfileSocialCountsProvider
        value={{
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          followingObjectsCount: objectsHead.total,
          hashtagsExpCount: expertiseCounts.hashtagsExpCount,
          objectsExpCount: expertiseCounts.objectsExpCount,
        }}
      >
        <UserProfilePendingNavRoot>
          <Suspense fallback={null}>
            <UserProfilePendingNavSync />
            <ProfileFeedTabMarkReadEffect accountName={accountName} viewerUsername={viewer} />
            <UserProfileHeroClient
              accountName={accountName}
              initialUser={profile}
              sidebar={sidebar}
              viewerUsername={viewer}
            />
            <ShellFullBleedBand className="shell-profile-content-band">
              <ShellInset className="pt-0">{children}</ShellInset>
            </ShellFullBleedBand>
          </Suspense>
        </UserProfilePendingNavRoot>
      </UserProfileSocialCountsProvider>
    </UserProfileFeedUnreadProvider>
  );
}
