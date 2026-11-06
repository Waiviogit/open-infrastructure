'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';

/** Activity / Threads / Updates tabs for guests: they read the viewer's followed objects. */
export function HomeFeedGuestPrompt() {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();

  return (
    <section
      className="rounded-card border border-border bg-surface/80 p-card-padding"
      aria-labelledby="home-feed-guest-title"
    >
      <h2
        id="home-feed-guest-title"
        className="font-display text-body-lg font-weight-strong text-fg"
      >
        {t('home_feed_guest_title')}
      </h2>
      <p className="mt-2 text-body-sm text-muted">{t('home_feed_guest_body')}</p>
      <button
        type="button"
        className="mt-4 rounded-btn bg-accent px-4 py-2 font-label text-body-sm font-weight-strong text-accent-fg hover:bg-accent-hover"
        onClick={openLogin}
      >
        {t('login')}
      </button>
    </section>
  );
}
