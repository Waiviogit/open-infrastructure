'use client';

import { Suspense, use, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { BellIcon } from '@/icons';
import {
  OptimisticNavLink,
  StatHoverTooltip,
  UserAvatar,
} from '@/shared/presentation';

import type { UserAccountSidebarView } from '../../domain/types/user-account-sidebar-view';
import type { UserProfileShellUser } from './types';
import { UserProfileMobileHeroDetails } from './user-profile-mobile-hero-details';
import { UserProfileMobileHeroMeta } from './user-profile-mobile-hero-meta';

export type UserHeaderProps = {
  user: UserProfileShellUser;
  username: string;
  /**
   * Account sidebar (live Hive / Engine reads, the slowest profile query) — reputation and the
   * mobile meta stream in behind their own placeholders, so the rest of the header never waits.
   * `null` while the hero is painted from the profile head (no sidebar request yet).
   */
  sidebar: Promise<UserAccountSidebarView | null> | null;
  isSameUser: boolean;
  isGuest: boolean;
  isFollowing: boolean;
  isBell: boolean;
  hasCover: boolean;
  coverImage: string | null;
  /**
   * Painted from the profile head before the viewer is known: no viewer controls (follow, bell,
   * edit, guest badge), sidebar parts as placeholders.
   */
  pending?: boolean;
  onFollowClick: () => void;
  onBellToggle: () => void;
  followPending?: boolean;
};

function ResolvedSidebarPart({
  sidebar,
  render,
}: {
  sidebar: Promise<UserAccountSidebarView | null>;
  render: (value: UserAccountSidebarView) => ReactNode;
}) {
  const value = use(sidebar);
  return value ? render(value) : null;
}

/** One sidebar-backed part of the header: placeholder until the sidebar resolves. */
function SidebarPart({
  sidebar,
  loading,
  render,
}: {
  sidebar: Promise<UserAccountSidebarView | null> | null;
  loading: ReactNode;
  render: (value: UserAccountSidebarView) => ReactNode;
}) {
  if (!sidebar) {
    return loading;
  }
  return (
    <Suspense fallback={loading}>
      <ResolvedSidebarPart sidebar={sidebar} render={render} />
    </Suspense>
  );
}

export function UserHeader({
  user,
  username,
  sidebar,
  isSameUser,
  isGuest,
  isFollowing,
  isBell,
  hasCover,
  coverImage,
  pending = false,
  onFollowClick,
  onBellToggle,
  followPending = false,
}: UserHeaderProps) {
  const { t } = useI18n();
  const hasCoverPhoto = Boolean(hasCover && coverImage);
  const showViewerControls = !pending;

  return (
    <div
      className={[
        'relative flex flex-col items-center gap-4 pb-4 text-center lg:flex-row lg:items-end lg:text-left',
        hasCoverPhoto ? '' : '-mt-12',
      ].join(' ')}
    >
      <div className="shrink-0 self-center lg:self-start">
        <UserAvatar
          username={username}
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          size={96}
          className="text-body-lg font-weight-strong font-display"
        />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
          <h1
            className={[
              'truncate text-section font-weight-strong font-display',
              hasCoverPhoto ? 'hero-on-photo-title' : 'text-fg',
            ].join(' ')}
          >
            {user.displayName}
          </h1>
          <SidebarPart
            sidebar={sidebar}
            loading={REPUTATION_PLACEHOLDER}
            render={(value) => (
              <StatHoverTooltip content={t('steem_reputation')}>
                <span className="rounded-btn border border-border bg-surface-control px-2 py-0.5 font-mono text-body-sm tabular-nums text-fg">
                  {value.hive.reputation.toFixed(2)}
                </span>
              </StatHoverTooltip>
            )}
          />
          <span
            className={[
              'text-body-sm',
              hasCoverPhoto ? 'hero-on-photo-muted' : 'text-muted',
            ].join(' ')}
          >
            @{username}
          </span>
          {showViewerControls && isGuest ? (
            <span className="rounded-btn bg-surface px-2 py-0.5 text-caption capitalize text-muted">
              {t('guest')}
            </span>
          ) : null}
        </div>
        <SidebarPart
          sidebar={sidebar}
          loading={
            <UserProfileMobileHeroMeta
              sidebar={LOADING_SIDEBAR_PLACEHOLDER}
              isLoading
            />
          }
          render={(value) => (
            <UserProfileMobileHeroMeta
              sidebar={value}
              onCover={hasCoverPhoto}
            />
          )}
        />
        <p
          className={[
            'mt-2 hidden text-caption lg:block',
            hasCoverPhoto ? 'hero-on-photo-muted' : 'text-muted',
          ].join(' ')}
        >
          <StatHoverTooltip content={t('stat_user_followers_tooltip')}>
            <span>
              {user.followerCount} {t('followers')}
            </span>
          </StatHoverTooltip>
          {' · '}
          {user.followingCount} {t('following')} · {user.postingCount}{' '}
          {t('posts')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end lg:pb-1">
        {showViewerControls && !isSameUser && !isGuest ? (
          <>
            <button
              type="button"
              onClick={onFollowClick}
              disabled={followPending}
              className={[
                'group rounded-btn px-4 py-2 text-body-sm font-weight-label disabled:opacity-50',
                isFollowing
                  ? 'hero-follow-active'
                  : 'bg-accent text-accent-fg hover:opacity-90',
              ].join(' ')}
            >
              <span className={isFollowing ? 'group-hover:hidden' : ''}>
                {isFollowing ? t('following') : t('follow')}
              </span>
              {isFollowing ? (
                <span className="hidden group-hover:inline">
                  {t('unfollow')}
                </span>
              ) : null}
            </button>
            {isFollowing ? (
              <button
                type="button"
                onClick={onBellToggle}
                className={[
                  'rounded-btn p-2',
                  hasCoverPhoto
                    ? 'hero-on-photo-btn'
                    : 'border border-border bg-bg text-fg hover:bg-muted',
                ].join(' ')}
                aria-pressed={isBell}
                title={
                  isBell ? t('user_hero_bell_on') : t('user_hero_bell_off')
                }
                aria-label={
                  isBell ? t('user_hero_bell_on') : t('user_hero_bell_off')
                }
              >
                <BellIcon
                  size={22}
                  className={
                    isBell ? 'fill-accent text-accent' : 'text-current'
                  }
                />
              </button>
            ) : null}
          </>
        ) : null}
        {showViewerControls && isSameUser ? (
          <OptimisticNavLink
            href="/edit-profile"
            suppressHydrationWarning
            className={[
              'rounded-btn px-4 py-2 text-body-sm font-weight-label',
              hasCoverPhoto
                ? 'hero-on-photo-btn'
                : 'border border-border text-fg hover:bg-surface',
            ].join(' ')}
          >
            {t('edit_profile')}
          </OptimisticNavLink>
        ) : null}
      </div>

      <SidebarPart
        sidebar={sidebar}
        loading={
          <UserProfileMobileHeroDetails
            bio={user.bio}
            sidebar={LOADING_SIDEBAR_PLACEHOLDER}
            isLoading
          />
        }
        render={(value) => (
          <UserProfileMobileHeroDetails
            bio={user.bio}
            sidebar={value}
            onCover={hasCoverPhoto}
          />
        )}
      />
    </div>
  );
}

const REPUTATION_PLACEHOLDER = (
  <span
    className="inline-block h-6 w-12 animate-pulse rounded-btn bg-surface-control"
    aria-hidden
  />
);

const LOADING_SIDEBAR_PLACEHOLDER: UserAccountSidebarView = {
  about: '',
  location: null,
  website: null,
  email: null,
  joinedAt: null,
  expertiseWeight: 0,
  lastActivityAt: null,
  totalVoteValueUsd: 0,
  socialLinks: [],
  cryptoWallets: [],
  waiv: {
    upvotingManaPercent: 0,
    downvotingManaPercent: 0,
    voteValueUsd: 0,
  },
  hive: {
    reputation: 25,
    upvotingManaPercent: 0,
    downvotingManaPercent: 0,
    resourceCreditsPercent: 0,
    voteValueUsd: 0,
  },
};
