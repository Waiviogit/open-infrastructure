'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useOdlCustomJsonId } from '@/config/odl-network-provider';
import { useLoginModal } from '@/modules/auth/presentation';
import {
  broadcastUserFollowBell,
  broadcastUserFollowToggle,
} from '@/modules/user-social/infrastructure/broadcast-user-subscription';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { revalidateUserSocialAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import type { UserAccountSidebarView } from '../../domain/types/user-account-sidebar-view';
import type { UserProfileShellUser } from './types';
import { UserHero } from './user-hero';

export type UserProfileHeroClientProps = {
  accountName: string;
  initialUser: UserProfileShellUser;
  /** Streams in (live chain reads); reputation and mobile meta wait for it, nothing else does. */
  sidebar: Promise<UserAccountSidebarView | null> | null;
  viewerUsername: string | null;
  /** Hero painted from the profile head: viewer unknown, controls hidden. */
  pending?: boolean;
};

/**
 * Client boundary for profile hero: pathname/search for nav, follow / bell state.
 */
export function UserProfileHeroClient({
  accountName,
  initialUser,
  sidebar,
  viewerUsername,
  pending = false,
}: UserProfileHeroClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const router = useRouter();
  const { openLogin } = useLoginModal();
  const odlCustomJsonId = useOdlCustomJsonId();
  const [isFollowing, setIsFollowing] = useState(initialUser.isFollowing);
  const [viewerBell, setViewerBell] = useState(initialUser.viewerBell);
  const [followPending, setFollowPending] = useState(false);
  const [bellPending, setBellPending] = useState(false);

  useEffect(() => {
    setIsFollowing(initialUser.isFollowing);
    setViewerBell(initialUser.viewerBell);
  }, [initialUser.isFollowing, initialUser.viewerBell]);

  const isSameUser =
    viewerUsername != null && viewerUsername.toLowerCase() === accountName.toLowerCase();
  const isGuest = viewerUsername == null;

  const onFollowClick = useCallback(async () => {
    const account = viewerUsername?.trim();
    if (!account) {
      openLogin();
      return;
    }
    if (followPending || isSameUser) {
      return;
    }
    const previousFollowing = isFollowing;
    const previousBell = viewerBell;
    setIsFollowing(!previousFollowing);
    if (previousFollowing) {
      setViewerBell(false);
    }
    setFollowPending(true);
    try {
      await broadcastUserFollowToggle(account, accountName, previousFollowing);
      await refreshAfterBroadcast(router, async () => {
        await Promise.all([
          revalidateUserSocialAfterBroadcast(accountName),
          revalidateUserSocialAfterBroadcast(account),
        ]);
      });
    } catch {
      setIsFollowing(previousFollowing);
      setViewerBell(previousBell);
    } finally {
      setFollowPending(false);
    }
  }, [
    accountName,
    followPending,
    isFollowing,
    isSameUser,
    openLogin,
    router,
    viewerBell,
    viewerUsername,
  ]);

  const onBellToggle = useCallback(async () => {
    const account = viewerUsername?.trim();
    if (!account) {
      openLogin();
      return;
    }
    if (bellPending || !isFollowing) {
      return;
    }
    const previousBell = viewerBell;
    const nextBell = !viewerBell;
    setViewerBell(nextBell);
    setBellPending(true);
    try {
      await broadcastUserFollowBell(account, accountName, nextBell, odlCustomJsonId);
      await refreshAfterBroadcast(router, () =>
        revalidateUserSocialAfterBroadcast(accountName),
      );
    } catch {
      setViewerBell(previousBell);
    } finally {
      setBellPending(false);
    }
  }, [
    accountName,
    bellPending,
    isFollowing,
    openLogin,
    odlCustomJsonId,
    router,
    viewerBell,
    viewerUsername,
  ]);

  const hasCover = Boolean(initialUser.coverImageUrl);
  const coverImage = initialUser.coverImageUrl;

  return (
    <UserHero
      user={initialUser}
      username={accountName}
      sidebar={sidebar}
      isSameUser={isSameUser}
      isGuest={isGuest}
      isFollowing={isFollowing}
      isBell={viewerBell}
      hasCover={hasCover}
      coverImage={coverImage}
      pending={pending}
      onFollowClick={onFollowClick}
      onBellToggle={onBellToggle}
      followPending={followPending}
      pathname={pathname}
      search={search}
    />
  );
}
