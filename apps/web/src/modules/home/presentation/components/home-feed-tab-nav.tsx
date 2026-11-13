'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import {
  OptimisticNavLink,
  profileSectionTabClass,
  useEffectiveNav,
} from '@/shared/presentation';
import {
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS,
  ScrollableHorizontalTabNav,
} from '@/shared/presentation/layout';

import { buildHomeFeedHref, parseHomeFeedFilter } from '../../domain/home-feed-filter';
import {
  HOME_FEED_TABS,
  resolveActiveHomeFeedTab,
  type HomeFeedTabKey,
} from '../../domain/home-feed-tabs';

type HomeFeedTabNavViewProps = {
  activeKey: HomeFeedTabKey | null;
  /** Current search string; the rail filter it names is carried to every tab. */
  search: string;
};

/** Posts / Threads / Activity / Updates as a horizontal second-level menu. */
export function HomeFeedTabNavView({ activeKey, search }: HomeFeedTabNavViewProps) {
  const { t } = useI18n();
  const filter = parseHomeFeedFilter(new URLSearchParams(search));

  return (
    <ScrollableHorizontalTabNav
      ariaLabel={t('home_feed_menu_aria')}
      rowClass={`${HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS} gap-x-1`}
      bleed="gutter"
      centerWhenNoOverflow
      activeItemSelector='nav a[aria-current="page"]'
      scrollPrevAriaLabel={t('previous')}
      scrollNextAriaLabel={t('next')}
    >
      {HOME_FEED_TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <OptimisticNavLink
            key={tab.key}
            href={buildHomeFeedHref(tab.href, filter)}
            prefetchShell
            className={profileSectionTabClass(active, 'primary')}
            aria-current={active ? 'page' : undefined}
          >
            {t(tab.labelKey)}
          </OptimisticNavLink>
        );
      })}
    </ScrollableHorizontalTabNav>
  );
}

/** Tab menu bound to the URL (optimistic while a navigation is pending). */
export function HomeFeedTabNav() {
  const { pathname, search } = useEffectiveNav();
  return <HomeFeedTabNavView activeKey={resolveActiveHomeFeedTab(pathname)} search={search} />;
}
