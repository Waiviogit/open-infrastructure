'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

export type SocialFollowButtonProps = {
  /** The logged-in viewer's follow state for this row (guests: `false`). */
  isFollowing: boolean;
  pending: boolean;
  onClick: () => void;
};

/** Follow / Following (Unfollow on hover) control for social list rows. Guests click it to open login. */
export function SocialFollowButton({ isFollowing, pending, onClick }: SocialFollowButtonProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isFollowing}
      onClick={onClick}
      className={[
        'group shrink-0 rounded-btn border px-3 py-1.5 text-body-sm font-weight-label transition-colors disabled:opacity-50',
        isFollowing
          ? 'border-border bg-surface-control text-muted hover:border-error hover:bg-error/10 hover:text-error'
          : 'border-accent text-accent hover:bg-accent/10',
      ].join(' ')}
    >
      <span className={isFollowing ? 'group-hover:hidden' : ''}>
        {isFollowing ? t('following') : t('follow')}
      </span>
      {isFollowing ? <span className="hidden group-hover:inline">{t('unfollow')}</span> : null}
    </button>
  );
}
