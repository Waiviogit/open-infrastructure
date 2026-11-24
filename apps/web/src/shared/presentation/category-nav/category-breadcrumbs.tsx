'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronDownIcon } from '@/icons';

import { MOBILE_MENU_PILL_CLASS } from '../components/mobile-pill-class';

import type { CategoryNavLink } from './category-nav.types';

/**
 * Row of a category breadcrumb trail. Fixed height so the content below never moves while a
 * navigation is pending; taller below `lg`, where the current crumb is a tinted pill and the
 * Filter button may share the row.
 */
export const CATEGORY_CRUMBS_ROW_CLASS = 'mb-card-padding flex h-8 min-w-0 items-center gap-2 lg:h-6';

export type CategoryCrumb = { key: string; label: string; href: string };

/** Below `lg`, the current crumb opens the category drawer. */
export type CategoryCrumbMenu = {
  open: boolean;
  onOpen: () => void;
  /** Accessible name of the drawer (read after the crumb label). */
  ariaLabel: string;
};

const CURRENT_CRUMB_CLASS = 'truncate font-weight-label text-fg';

function CurrentCrumb({ label, menu }: { label: string; menu: CategoryCrumbMenu | null }) {
  if (!menu) {
    return (
      <span aria-current="page" className={CURRENT_CRUMB_CLASS}>
        {label}
      </span>
    );
  }
  return (
    <>
      <span aria-current="page" className={`hidden lg:inline ${CURRENT_CRUMB_CLASS}`}>
        {label}
      </span>
      <button
        type="button"
        className={`${MOBILE_MENU_PILL_CLASS} lg:hidden`}
        aria-haspopup="dialog"
        aria-expanded={menu.open}
        aria-label={`${label}, ${menu.ariaLabel}`}
        onClick={menu.onOpen}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon size={16} className="shrink-0" />
      </button>
    </>
  );
}

export type CategoryBreadcrumbsProps = {
  /** Root first; the last crumb is the current page. */
  crumbs: readonly CategoryCrumb[];
  NavLink: CategoryNavLink;
  /** Below `lg` the current crumb is a tinted pill opening the category drawer. */
  menu?: CategoryCrumbMenu | null;
  /** Controls on the same row after the trail (the mobile Filter button). */
  trailing?: ReactNode;
};

/**
 * `All › Category › Subcategory` trail of a category tree (profile Favorites, Discover). Every
 * crumb but the last links back; the last one is the current page.
 */
export function CategoryBreadcrumbs({
  crumbs,
  NavLink,
  menu = null,
  trailing,
}: CategoryBreadcrumbsProps) {
  const { t } = useI18n();
  return (
    <div className={CATEGORY_CRUMBS_ROW_CLASS}>
      <nav aria-label={t('favorites_breadcrumb_aria')} className="flex min-w-0 items-center">
        <ol className="flex min-w-0 list-none flex-nowrap items-center gap-x-2 overflow-hidden p-0 text-body-sm">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={crumb.key} className="flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="text-fg-tertiary">
                    ›
                  </span>
                ) : null}
                {isLast ? (
                  <CurrentCrumb label={crumb.label} menu={menu} />
                ) : (
                  <NavLink
                    href={crumb.href}
                    className="truncate text-fg-secondary underline-offset-2 hover:text-fg hover:underline"
                  >
                    {crumb.label}
                  </NavLink>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {trailing}
    </div>
  );
}
