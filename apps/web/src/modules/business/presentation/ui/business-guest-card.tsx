'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useLoginModal } from '@/modules/auth';

import { BusinessButton } from './business-button';
import { businessCardClass } from './classes';

/**
 * What signing in unlocks in Market, for signed-out visitors of the catalog. `rail` sits under the
 * filters (desktop); `inline` is the compact row above the list below `lg`.
 */
export function BusinessGuestCard({ layout }: { layout: 'rail' | 'inline' }) {
  const { t } = useI18n();
  const { openLogin } = useLoginModal();
  const inline = layout === 'inline';

  return (
    <section
      className={businessCardClass({
        className: inline
          ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
          : 'flex flex-col gap-3',
      })}
      aria-labelledby={`business-guest-${layout}`}
    >
      <div className="min-w-0">
        <h2
          id={`business-guest-${layout}`}
          className="text-body font-weight-strong text-heading"
        >
          {t('business_guest_card_title')}
        </h2>
        <p className="mt-1 text-body-sm text-fg">
          {t('business_guest_card_body')}
        </p>
      </div>
      <BusinessButton
        variant="primary"
        size="sm"
        className="self-start sm:shrink-0"
        onClick={openLogin}
      >
        {t('signin')}
      </BusinessButton>
    </section>
  );
}
