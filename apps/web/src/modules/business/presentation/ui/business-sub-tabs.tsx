'use client';

import type { ReactNode } from 'react';

import {
  HORIZONTAL_TAB_NAV_SUB_ROW_CLASS,
  OptimisticNavLink,
  ScrollableHorizontalTabNav,
  parseNavHref,
  profileSectionTabClass,
  useEffectiveNav,
  type NavTarget,
} from '@/shared/presentation';

import { BUSINESS_FOCUS_RING } from './classes';

export type BusinessSubTab = {
  id: string;
  href: string;
  label: string;
  icon?: ReactNode;
};

/**
 * Picks the tab the user is heading to (optimistic) or is on: same pathname, then the exact
 * query, else the tab whose href has no query (the route's default tab).
 */
export function resolveActiveSubTab(
  items: readonly BusinessSubTab[],
  target: NavTarget,
  fallbackId: string,
): string {
  const samePath = items.filter(
    (item) => parseNavHref(item.href).pathname === target.pathname,
  );
  if (samePath.length === 0) {
    return fallbackId;
  }
  const exact = samePath.find(
    (item) => parseNavHref(item.href).search === target.search,
  );
  if (exact) {
    return exact.id;
  }
  const byDefault = samePath.find(
    (item) => parseNavHref(item.href).search === '',
  );
  return byDefault?.id ?? fallbackId;
}

export type BusinessSubTabsProps = {
  items: readonly BusinessSubTab[];
  /** Server-side active tab; the optimistic target overrides it right after a click. */
  activeId: string;
  ariaLabel: string;
  /** `replace` for same-route query tabs (relationship ledger), `push` for route tabs. */
  method?: 'push' | 'replace';
  className?: string;
};

/**
 * Underlined, horizontally scrolling sub-tabs (same look as profile / Favorites sub-menus).
 * URL and active state update on click, before the server answers.
 */
export function BusinessSubTabs({
  items,
  activeId,
  ariaLabel,
  method = 'push',
  className = 'mb-card-padding',
}: BusinessSubTabsProps) {
  const effective = useEffectiveNav();
  const active = resolveActiveSubTab(items, effective, activeId);

  return (
    <ScrollableHorizontalTabNav
      ariaLabel={ariaLabel}
      rowClass={HORIZONTAL_TAB_NAV_SUB_ROW_CLASS}
      bleed="none"
      className={className}
      activeItemSelector='a[aria-current="page"]'
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <OptimisticNavLink
            key={item.id}
            href={item.href}
            method={method}
            prefetchShell
            aria-current={isActive ? 'page' : undefined}
            className={`${profileSectionTabClass(isActive, 'sub')} gap-2 ${BUSINESS_FOCUS_RING}`}
          >
            {item.icon}
            {item.label}
          </OptimisticNavLink>
        );
      })}
    </ScrollableHorizontalTabNav>
  );
}
