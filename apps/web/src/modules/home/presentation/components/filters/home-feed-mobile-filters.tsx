'use client';

import { useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronDownIcon } from '@/icons';
import { MOBILE_MENU_PILL_CLASS, useEffectiveNav } from '@/shared/presentation';
import { DrawerRegion } from '@/shared/presentation/layout';

import { useHomeFeedActiveFilterLabel } from './home-feed-active-filter-label';

/**
 * Below `lg` the rail lives in a left drawer under the app header, opened from a tinted pill
 * above the feed named after the active filter (same pill as the Discover / Favorites `All ▾`).
 * Picking a filter changes the URL, which closes the drawer.
 */
export function HomeFeedMobileFilters({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { search } = useEffectiveNav();
  const activeLabel = useHomeFeedActiveFilterLabel();
  const [open, setOpen] = useState(false);
  const [openedAtSearch, setOpenedAtSearch] = useState(search);
  if (open && search !== openedAtSearch) {
    setOpen(false);
  }

  return (
    <div className="mb-card-padding lg:hidden">
      <button
        type="button"
        className={`${MOBILE_MENU_PILL_CLASS} max-w-full`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpenedAtSearch(search);
          setOpen(true);
        }}
      >
        {activeLabel ? (
          <span className="min-w-0 truncate">{activeLabel}</span>
        ) : (
          <>
            {/* The rail streams in; keep the trigger's size until it names the filter. */}
            <span className="h-5 w-24 animate-pulse rounded-btn bg-ghost-surface" aria-hidden />
            <span className="sr-only">{t('home_feed_filters_aria')}</span>
          </>
        )}
        <ChevronDownIcon size={16} className="shrink-0" />
      </button>
      <DrawerRegion
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        belowHeader
        size="wide"
        ariaLabel={t('home_feed_filters_aria')}
      >
        {children}
      </DrawerRegion>
    </div>
  );
}
