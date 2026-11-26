import { Suspense } from 'react';

import { ProfileHeadShell } from '@/modules/user-profile';
import { getUserHeadQuery } from '@/modules/user-profile/application/queries/get-user-head.query';
import { ScrollToTopOnEnter } from '@/shared/presentation';

import UserProfileNameLoading from '../loading';
import { ProfileGroupFull } from './profile-group-full.server';

type ProfileGroupLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
};

/**
 * Two stages behind the profile skeleton (entering the group from a post page, which shares
 * `[name]`, paints at once):
 * 1. the cached profile head (no viewer) → `ProfileHeadShell`, the real hero with inert controls;
 *    a link prefetched on intent carries it, so the hero is there on click;
 * 2. `ProfileGroupFull` — viewer, full profile, counters and the tab content.
 */
export default function ProfileGroupLayout({ children, params }: ProfileGroupLayoutProps) {
  return (
    <Suspense fallback={<UserProfileNameLoading />}>
      <ProfileGroupHead params={params}>{children}</ProfileGroupHead>
    </Suspense>
  );
}

async function ProfileGroupHead({ children, params }: ProfileGroupLayoutProps) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);
  const head = await getUserHeadQuery(accountName);

  return (
    <>
      {/* Outside the full-page boundary: resets once when the hero appears, not again after it. */}
      <ScrollToTopOnEnter routeKey={accountName.toLowerCase()} />
      <Suspense
        fallback={
          head.kind === 'found' ? (
            <ProfileHeadShell accountName={accountName} head={head.user} />
          ) : (
            <UserProfileNameLoading />
          )
        }
      >
        <ProfileGroupFull accountName={accountName}>{children}</ProfileGroupFull>
      </Suspense>
    </>
  );
}
