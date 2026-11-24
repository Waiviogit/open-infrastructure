'use client';

import { useMemo } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { formatObjectTypeLabel } from '@/modules/app-header/domain/search-nav-list';
import { profileSectionTabClass, useEffectiveNav } from '@/shared/presentation';
import {
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS,
  ScrollableHorizontalTabNav,
  ShellFullBleedBand,
  ShellInset,
} from '@/shared/presentation/layout';

import {
  buildDiscoverHref,
  DISCOVER_PATH,
  parseDiscoverPageState,
} from '../../domain/discover-url';
import {
  discoverMoreTypeTab,
  listDiscoverPopularObjectTypes,
} from '../../domain/discover-registry';
import {
  DISCOVER_USERS_ICON,
  iconForDiscoverObjectType,
} from '../../domain/discover-type-icons';
import { DiscoverMoreTypesMenu } from './discover-more-types-menu';
import { DiscoverTypeTabLink } from './discover-type-tab-link';

/**
 * Discover type menu: popular types, Users, the active More type (when one is picked) and More.
 * Type links keep the search and sort and drop type-specific filters (tags, map area). Mixed
 * search results (`type=all`) leave every tab inactive.
 */
export function DiscoverTypesNav({ search }: { search: string }) {
  const { t } = useI18n();
  const { usersMode, objectType, q, sort } = useMemo(
    () => parseDiscoverPageState(new URLSearchParams(search)),
    [search],
  );
  const popularTypes = useMemo(() => listDiscoverPopularObjectTypes(), []);
  const moreTypeTab = discoverMoreTypeTab(objectType, usersMode);
  const activeType = usersMode ? null : objectType;

  return (
    <ScrollableHorizontalTabNav
      ariaLabel={t('discover_types_nav_aria')}
      rowClass={`${HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS} gap-x-1`}
      bleed="gutter"
      centerWhenNoOverflow
      activeItemSelector='nav a[aria-current="page"]'
      scrollPrevAriaLabel={t('previous')}
      scrollNextAriaLabel={t('next')}
    >
      {popularTypes.map((type) => (
        <DiscoverTypeTabLink
          key={type}
          href={buildDiscoverHref({ type, q, sort })}
          icon={iconForDiscoverObjectType(type)}
          label={formatObjectTypeLabel(type)}
          active={type === activeType}
          className={profileSectionTabClass(type === activeType, 'primary')}
          rememberType={type}
        />
      ))}
      <DiscoverTypeTabLink
        href={buildDiscoverHref({ users: true, q, sort })}
        icon={DISCOVER_USERS_ICON}
        label={t('discover_users_menu')}
        active={usersMode}
        className={profileSectionTabClass(usersMode, 'primary')}
      />
      {moreTypeTab ? (
        <DiscoverTypeTabLink
          href={buildDiscoverHref({ type: moreTypeTab, q, sort })}
          icon={iconForDiscoverObjectType(moreTypeTab)}
          label={formatObjectTypeLabel(moreTypeTab)}
          active
          className={profileSectionTabClass(true, 'primary')}
          rememberType={moreTypeTab}
        />
      ) : null}
      <DiscoverMoreTypesMenu activeType={activeType} q={q} sort={sort} />
    </ScrollableHorizontalTabNav>
  );
}

/**
 * Discover type menu as the hub's second-level band (same chrome as the Feed and Market bands),
 * shown on `/discover`. Follows the optimistic navigation target, like the hub section nav.
 */
export function HubDiscoverTabBand() {
  const { pathname, search } = useEffectiveNav();
  if (pathname !== DISCOVER_PATH) {
    return null;
  }
  return (
    <ShellFullBleedBand className="bg-surface shadow-card">
      <ShellInset className="pt-0">
        <DiscoverTypesNav search={search} />
      </ShellInset>
    </ShellFullBleedBand>
  );
}
