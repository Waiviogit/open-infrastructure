'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

/** Client-side title keeps the settings page free of request reads (fully static shell). */
export function SettingsHeading() {
  const { t } = useI18n();
  return (
    <h1 className="mb-6 font-display text-section text-heading leading-display">
      {t('settings')}
    </h1>
  );
}
