'use client';

import { useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { Icon } from '@/icons';
import { useEffectiveNav } from '@/shared/presentation';
import { DrawerRegion } from '@/shared/presentation/layout';

import { parseHomeFeedFilter, type HomeFeedFilter } from '../../../domain/home-feed-filter';

const FILTER_LABEL_KEYS = {
  trending: 'home_feed_filter_trending',
  hot: 'home_feed_filter_hot',
  new: 'home_feed_filter_new',
  my: 'home_feed_filter_my_feed',
} as const;

function filterLabel(filter: HomeFeedFilter | null, t: (key: string) => string): string | null {
  if (!filter) {
    return null;
  }
  switch (filter.kind) {
    case 'author':
      return `@${filter.account}`;
    case 'object':
      return filter.objectId;
    default:
      return t(FILTER_LABEL_KEYS[filter.kind]);
  }
}

/**
 * Below `lg` the rail lives in a left drawer opened from a button above the feed.
 * Picking a filter changes the URL, which closes the drawer.
 */
export function HomeFeedMobileFilters({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { search } = useEffectiveNav();
  const [open, setOpen] = useState(false);
  const [openedAtSearch, setOpenedAtSearch] = useState(search);
  if (open && search !== openedAtSearch) {
    setOpen(false);
  }

  const active = filterLabel(parseHomeFeedFilter(new URLSearchParams(search)), t);
  const label = active
    ? t('home_feed_filters_mobile_trigger').replace('{filter}', active)
    : t('home_feed_filters_title');

  return (
    <div className="mb-card-padding lg:hidden">
      <button
        type="button"
        className="inline-flex max-w-full items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5 text-body-sm text-fg hover:bg-ghost-surface"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpenedAtSearch(search);
          setOpen(true);
        }}
      >
        <Icon name="filter" size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <DrawerRegion open={open} onClose={() => setOpen(false)} side="left" ariaLabel={t('home_feed_filters_aria')}>
        {children}
      </DrawerRegion>
    </div>
  );
}
