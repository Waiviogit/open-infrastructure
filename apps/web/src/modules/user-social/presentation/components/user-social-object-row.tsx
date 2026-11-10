'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { objectFields, type ProjectedObjectView } from '@/modules/feed/application/dto/object-fields';
import type { SocialProjectedObjectView } from '@/modules/user-social/application/dto/user-social.dto';
import { useOdlCustomJsonId } from '@/config/odl-network-provider';
import { useLoginModal } from '@/modules/auth/presentation';
import { broadcastObjectFollowToggle } from '@/modules/user-social/infrastructure/broadcast-object-follow';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import {
  revalidateObjectAfterBroadcast,
  revalidateUserSocialAfterBroadcast,
} from '@/shared/infrastructure/query/revalidate-after-broadcast.server';
import { ObjectThumbnail, StatHoverTooltip } from '@/shared/presentation';
import { objectPagePath } from '@/shared/routes/object-page-path';

import { SocialFollowButton } from './social-follow-button';

const THUMB = 44;

export type UserSocialObjectRowProps = {
  object: SocialProjectedObjectView;
  profileAccountName: string;
  viewerUsername: string | null;
};

export function UserSocialObjectRow({
  object: o,
  profileAccountName,
  viewerUsername,
}: UserSocialObjectRowProps) {
  const { t } = useI18n();
  const odlCustomJsonId = useOdlCustomJsonId();
  const router = useRouter();
  const { openLogin } = useLoginModal();
  const [isCurrentFollowing, setIsCurrentFollowing] = useState(o.isCurrentFollowing);
  const [pending, setPending] = useState(false);
  const view = o as unknown as ProjectedObjectView;
  const name = objectFields.name(view) ?? o.object_id;
  const img = objectFields.image(view);
  const weight = o.weight ?? null;
  const weightLabel = weight == null ? '—' : weight.toFixed(2);
  const href = objectPagePath(o.object_id);

  useEffect(() => {
    setIsCurrentFollowing(o.isCurrentFollowing);
  }, [o.isCurrentFollowing]);

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
      await broadcastObjectFollowToggle(account, o.object_id, previous, odlCustomJsonId);
      await refreshAfterBroadcast(router, async () => {
        await Promise.all([
          revalidateUserSocialAfterBroadcast(profileAccountName),
          revalidateUserSocialAfterBroadcast(account),
          revalidateObjectAfterBroadcast(o.object_id),
        ]);
      });
    } catch {
      setIsCurrentFollowing(previous);
    } finally {
      setPending(false);
    }
  }, [
    isCurrentFollowing,
    o.object_id,
    odlCustomJsonId,
    openLogin,
    pending,
    profileAccountName,
    router,
    viewerUsername,
  ]);

  return (
    <li className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <div className="shrink-0">
        <Link
          href={href}
          prefetch={false}
          className="inline-flex rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label={`View object: ${name}`}
          suppressHydrationWarning
        >
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-card border border-border bg-surface ring-1 ring-border/60">
            <ObjectThumbnail
              src={img}
              size={THUMB}
              avatarSize="small"
              className="size-full object-cover"
              sizes={`${THUMB}px`}
            />
          </span>
        </Link>
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          prefetch={false}
          className="block truncate font-weight-label text-fg underline-offset-2 hover:underline focus-visible:rounded-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          suppressHydrationWarning
        >
          {name}
        </Link>
      </div>
      <StatHoverTooltip content={t('stat_object_expertise_tooltip')}>
        <span className="shrink-0 rounded-btn border border-border bg-surface-control px-2 py-0.5 font-mono text-body-sm text-fg-secondary">
          {weightLabel}
        </span>
      </StatHoverTooltip>
      <SocialFollowButton
        isFollowing={isCurrentFollowing}
        pending={pending}
        onClick={() => void onFollowClick()}
      />
    </li>
  );
}
