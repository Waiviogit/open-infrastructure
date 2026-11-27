'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { MessageKey } from '@/i18n/types';
import { OptimisticNavLink, profileSectionTabClass, useEffectiveNav } from '@/shared/presentation';

import { WAIV_PAGE_PATH, WAIV_SWAPS_PATH } from '../../domain/waiv-routes';

const TABS: ReadonlyArray<{ href: string; labelKey: MessageKey }> = [
  { href: WAIV_PAGE_PATH, labelKey: 'waiv_page_tab_stats' },
  { href: WAIV_SWAPS_PATH, labelKey: 'waiv_page_tab_swaps' },
];

/** Title and the two route tabs; the tab follows the optimistic navigation target. */
export function WaivPageShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useEffectiveNav();

  return (
    <main className="mx-auto w-full min-w-0 max-w-container-content px-gutter pt-section-y pb-section-y sm:px-gutter-sm">
      <h1 className="text-display font-display font-weight-display text-heading">
        {t('waiv_page_title')}
      </h1>
      <nav
        aria-label={t('waiv_page_tabs_aria')}
        className="mt-3 mb-6 flex min-w-0 flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <OptimisticNavLink
              key={tab.href}
              href={tab.href}
              prefetchShell
              className={profileSectionTabClass(active, 'primary')}
              aria-current={active ? 'page' : undefined}
            >
              {t(tab.labelKey)}
            </OptimisticNavLink>
          );
        })}
      </nav>
      {children}
    </main>
  );
}
