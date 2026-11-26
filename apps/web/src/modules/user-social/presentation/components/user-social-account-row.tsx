'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { MessageKey } from '@/i18n/types';
import { useLoginModal } from '@/modules/auth/presentation';
import { StatHoverTooltip, UserAvatar } from '@/shared/presentation';

import type { UserFollowListView } from '@/modules/user-social/application/dto/user-social.dto';
import { broadcastUserFollowToggle } from '@/modules/user-social/infrastructure/broadcast-user-subscription';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { revalidateUserSocialAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import { SocialFollowButton } from './social-follow-button';
import { ProfilePageLink } from '@/shared/presentation/components/profile-page-link';

export type UserSocialAccountRowProps = {
  row: UserFollowListView;
  profileAccountName: string;
  /** Current logged-in Hive account; when absent, the follow control opens the login modal. */
  viewerUsername: string | null;
  /** When set, badge shows per-object expertise instead of global wobjectsWeight. */
  expertiseWeight?: number;
  expertiseTooltipKey?: MessageKey;
  onBroadcastRevalidate?: (accountName: string) => Promise<void>;
};

export function UserSocialAccountRow({
  row,
  profileAccountName,
  viewerUsername,
  expertiseWeight,
  expertiseTooltipKey = 'stat_user_expertise_tooltip',
  onBroadcastRevalidate,
}: UserSocialAccountRowProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { openLogin } = useLoginModal();
  const isSelf =
    viewerUsername != null && viewerUsername.trim().toLowerCase() === row.name.toLowerCase();
  const showFollowControl = !isSelf;
  const [isCurrentFollowing, setIsCurrentFollowing] = useState(row.isCurrentFollowing);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setIsCurrentFollowing(row.isCurrentFollowing);
  }, [row.isCurrentFollowing]);

  const onFollowClick = useCallback(async () => {
    const account = viewerUsername?.trim();
    if (!account) {
      openLogin();
      return;
    }
    if (pending) {
      return;
    }
    const previous = isCurrentFollowing;
    setIsCurrentFollowing(!previous);
    setPending(true);
    try {
      await broadcastUserFollowToggle(account, row.name, previous);
      await refreshAfterBroadcast(router, async () => {
        await Promise.all([
          onBroadcastRevalidate?.(profileAccountName),
          revalidateUserSocialAfterBroadcast(account),
          revalidateUserSocialAfterBroadcast(row.name),
        ]);
      });
    } catch {
      setIsCurrentFollowing(previous);
    } finally {
      setPending(false);
    }
  }, [
    isCurrentFollowing,
    onBroadcastRevalidate,
    openLogin,
    pending,
    profileAccountName,
    row.name,
    router,
    viewerUsername,
  ]);

  const badgeWeight = expertiseWeight ?? row.wobjectsWeight;

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <ProfilePageLink accountName={row.name} className="shrink-0">
        <UserAvatar username={row.name} avatarUrl={row.avatarUrl} displayName={row.name} size={44} />
      </ProfilePageLink>
      <div className="min-w-0 flex-1">
        <ProfilePageLink accountName={row.name} className="font-weight-label text-fg hover:underline">
          {row.name}
        </ProfilePageLink>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
          <StatHoverTooltip content={t(expertiseTooltipKey)}>
            <span className="rounded-btn border border-border bg-surface-control px-2 py-0.5 font-mono text-body-sm text-fg">
              {badgeWeight.toFixed(2)}
            </span>
          </StatHoverTooltip>
          <span aria-hidden>·</span>
          <StatHoverTooltip content={t('stat_user_followers_tooltip')}>
            <span>{row.usersFollowingCount}</span>
          </StatHoverTooltip>
        </p>
      </div>
      {showFollowControl ? (
        <SocialFollowButton
          isFollowing={isCurrentFollowing}
          pending={pending}
          onClick={() => void onFollowClick()}
        />
      ) : null}
    </li>
  );
}
