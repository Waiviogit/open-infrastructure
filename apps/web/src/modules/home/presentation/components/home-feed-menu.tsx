'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import {
  OptimisticNavLink,
  profileSectionTabClass,
  profileSectionVerticalLinkClass,
  useEffectiveNav,
} from '@/shared/presentation';
import {
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS,
  horizontalTabNavScrollShellClass,
} from '@/shared/presentation/layout';

import { HOME_FEED_TABS, resolveActiveHomeFeedTab } from '../../domain/home-feed-tabs';

type HomeFeedMenuProps = {
  /** `vertical` = desktop left rail; `horizontal` = mobile tabs above the feed. */
  orientation: 'vertical' | 'horizontal';
};

export function HomeFeedMenu({ orientation }: HomeFeedMenuProps) {
  const { t } = useI18n();
  const { pathname } = useEffectiveNav();
  const activeKey = resolveActiveHomeFeedTab(pathname);
  const vertical = orientation === 'vertical';

  const links = HOME_FEED_TABS.map((tab) => {
    const active = tab.key === activeKey;
    return (
      <OptimisticNavLink
        key={tab.key}
        href={tab.href}
        className={
          vertical
            ? profileSectionVerticalLinkClass(active)
            : profileSectionTabClass(active, 'primary')
        }
        aria-current={active ? 'page' : undefined}
      >
        {t(tab.labelKey)}
      </OptimisticNavLink>
    );
  });

  if (vertical) {
    return (
      <nav
        aria-label={t('home_feed_menu_aria')}
        className="flex flex-col gap-1 p-2"
      >
        {links}
      </nav>
    );
  }

  return (
    <div className={horizontalTabNavScrollShellClass('gutter')}>
      <nav aria-label={t('home_feed_menu_aria')} className={HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS}>
        {links}
      </nav>
    </div>
  );
}
