'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { Icon, type IconName } from '@/icons';
import {
  OptimisticNavLink,
  profileSectionTabClass,
  useEffectiveNav,
} from '@/shared/presentation';
import {
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS,
  ScrollableHorizontalTabNav,
  ShellFullBleedBand,
  ShellInset,
} from '@/shared/presentation/layout';

import {
  businessNavIdForPath,
  businessNavItems,
} from '../../domain/business-nav';
import type { BusinessNavId } from '../../domain/routes';

const TAB_ICONS: Readonly<Record<BusinessNavId, IconName>> = {
  discover: 'store',
  offers: 'briefcase',
  requests: 'hand-helping',
  relationships: 'users',
  arbitration: 'landmark',
  'dispute-resolution': 'flag',
};

const TAB_ICON_SIZE = 18;

/** Market sections as the hub's second-level band (same chrome as the Feed tab band). */
export function MarketTabNavView({
  activeId,
  signedIn,
}: {
  activeId: BusinessNavId | null;
  /** Guests only see the public catalog; the other sections need a session. */
  signedIn: boolean;
}) {
  const { t } = useI18n();

  return (
    <ScrollableHorizontalTabNav
      ariaLabel={t('business_nav_aria')}
      rowClass={`${HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS} gap-x-1`}
      bleed="gutter"
      centerWhenNoOverflow
      activeItemSelector='nav a[aria-current="page"]'
      scrollPrevAriaLabel={t('previous')}
      scrollNextAriaLabel={t('next')}
    >
      {businessNavItems(signedIn).map((item) => {
        const active = item.id === activeId;
        return (
          <OptimisticNavLink
            key={item.id}
            href={item.href}
            prefetchShell
            className={profileSectionTabClass(active, 'primary')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="inline-flex items-center gap-2">
              <Icon
                name={TAB_ICONS[item.id]}
                size={TAB_ICON_SIZE}
                className="shrink-0"
              />
              {t(item.labelKey)}
            </span>
          </OptimisticNavLink>
        );
      })}
    </ScrollableHorizontalTabNav>
  );
}

/**
 * Market tab band for the hub layout: rendered next to the hub section nav (outside the hub
 * content's horizontal clip, so the band spans the viewport) on `/business/*`. Follows the
 * optimistic navigation target, like the hub section nav. `signedIn` streams in from the hub
 * layout (guest fallback first, like the app header).
 */
export function HubMarketTabBand({ signedIn }: { signedIn: boolean }) {
  const { pathname } = useEffectiveNav();
  const activeId = businessNavIdForPath(pathname);
  if (activeId === null) {
    return null;
  }
  return (
    <ShellFullBleedBand className="bg-surface shadow-card">
      <ShellInset className="pt-0">
        {/* Six sections: centred across the full width (like the hub section nav above). */}
        <MarketTabNavView activeId={activeId} signedIn={signedIn} />
      </ShellInset>
    </ShellFullBleedBand>
  );
}
