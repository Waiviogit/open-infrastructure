'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { formatObjectTypeLabel } from '@/modules/app-header/domain/search-nav-list';
import { OptimisticNavLink } from '@/shared/presentation';
import {
  CategoryBreadcrumbs,
  CategoryNavDrawerList,
  CategoryNavList,
  CategoryNavPendingSkeleton,
  CategoryNavUpLinks,
  sameCategoryLineage,
  type CategoryCrumb,
  type CategoryHrefFor,
  type CategoryNavLinkProps,
  type CategoryNavOtherRow,
} from '@/shared/presentation/category-nav';
import { DrawerRegion } from '@/shared/presentation/layout';

import type { DiscoverCategoryNavState } from '../hooks/use-discover-category-nav';

/** Every Discover link replaces the URL (same-route query change); the drawer needs it too. */
export function DiscoverCategoryLink(props: CategoryNavLinkProps) {
  return <OptimisticNavLink method="replace" {...props} />;
}

/** Left rail card (same chrome as the Favorites rail). In page flow, not sticky. */
const RAIL_CARD_CLASS =
  'relative z-0 min-w-0 w-full self-start rounded-card border border-border bg-surface/60 p-card-padding';

/** The Other category of a level, for the rail and the drawer. */
export type DiscoverCategoryOtherNav = {
  /** Href of the Other category of a lineage. */
  hrefFor: CategoryHrefFor;
  /** The page shows the Other category of the active lineage (optimistic). */
  active: boolean;
};

/** The level's Other row: shown when the level lists categories and has groups outside them. */
function otherRow(
  nav: DiscoverCategoryNavState,
  other: DiscoverCategoryOtherNav,
  activeLineage: readonly string[],
): CategoryNavOtherRow | null {
  if (nav.status !== 'ready' || nav.items.length === 0 || nav.otherCount <= 0) {
    return null;
  }
  return {
    count: nav.otherCount,
    href: other.hrefFor(nav.navLineage),
    active: other.active && sameCategoryLineage(nav.navLineage, activeLineage),
  };
}

export type DiscoverCategoryRailProps = {
  objectType: string;
  nav: DiscoverCategoryNavState;
  /** Lineage of the URL (drives ← Up / All categories). */
  categoryPath: readonly string[];
  /** The URL shows the Other category of `categoryPath` (← Up goes to the category). */
  categoryOther: boolean;
  /** Optimistic lineage (highlights the clicked category before the URL settles). */
  activeLineage: readonly string[];
  hrefFor: CategoryHrefFor;
  other: DiscoverCategoryOtherNav;
};

/** Desktop left rail of Discover: the active type's category tree, counted in groups. */
export function DiscoverCategoryRail({
  objectType,
  nav,
  categoryPath,
  categoryOther,
  activeLineage,
  hrefFor,
  other,
}: DiscoverCategoryRailProps) {
  const { t } = useI18n();
  // Other is one level below its category, like a leaf: Up goes to the category itself.
  const upLineage = categoryOther ? categoryPath : categoryPath.slice(0, -1);
  return (
    <nav aria-label={t('discover_categories_aria')} className={RAIL_CARD_CLASS}>
      <p className="mb-2 truncate font-weight-label text-body-sm text-fg">
        {formatObjectTypeLabel(objectType)}
      </p>
      {categoryPath.length > 0 ? (
        <CategoryNavUpLinks
          upHref={hrefFor(upLineage)}
          allHref={hrefFor([])}
          NavLink={DiscoverCategoryLink}
        />
      ) : null}
      {nav.status === 'loading' ? (
        <CategoryNavPendingSkeleton />
      ) : nav.status === 'error' ? (
        <p className="py-1 text-body-sm text-muted">{t('profile_categories_unavailable')}</p>
      ) : (
        <CategoryNavList
          items={nav.items}
          parentLineage={nav.navLineage}
          activeName={activeLineage[activeLineage.length - 1] ?? null}
          hrefFor={hrefFor}
          NavLink={DiscoverCategoryLink}
          showCounts
          other={otherRow(nav, other, activeLineage)}
        />
      )}
    </nav>
  );
}

export type DiscoverCategoryBreadcrumbsProps = {
  categoryPath: readonly string[];
  /** Adds the `Other` crumb after the lineage. */
  categoryOther: boolean;
  hrefFor: CategoryHrefFor;
  /** Href of the Other category of `categoryPath`. */
  otherHref: string;
  /** Below `lg` the current crumb opens the category drawer. */
  drawer: { open: boolean; onOpen: () => void } | null;
  trailing?: ReactNode;
};

/**
 * `All › Category › Subcategory` (`› Other` for the Other category); `All` is the type root
 * (every object of the type).
 */
export function DiscoverCategoryBreadcrumbs({
  categoryPath,
  categoryOther,
  hrefFor,
  otherHref,
  drawer,
  trailing,
}: DiscoverCategoryBreadcrumbsProps) {
  const { t } = useI18n();
  const crumbs: CategoryCrumb[] = [
    { key: 'root', label: t('all'), href: hrefFor([]) },
    ...categoryPath.map((segment, index) => ({
      key: `category-${index}`,
      label: segment,
      href: hrefFor(categoryPath.slice(0, index + 1)),
    })),
    ...(categoryOther ? [{ key: 'other', label: t('category_other'), href: otherHref }] : []),
  ];
  return (
    <CategoryBreadcrumbs
      crumbs={crumbs}
      NavLink={DiscoverCategoryLink}
      menu={
        drawer
          ? { open: drawer.open, onOpen: drawer.onOpen, ariaLabel: t('discover_categories_aria') }
          : null
      }
      trailing={trailing}
    />
  );
}

export type DiscoverCategoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  objectType: string;
  nav: DiscoverCategoryNavState;
  activeLineage: readonly string[];
  hrefFor: CategoryHrefFor;
  other: DiscoverCategoryOtherNav;
};

/**
 * Below `lg`: the category tree in a left drawer under the app header, one level at a time (same
 * pattern as the Favorites drawer). Back closes it; its links replace the URL.
 */
export function DiscoverCategoryDrawer({
  open,
  onClose,
  objectType,
  nav,
  activeLineage,
  hrefFor,
  other,
}: DiscoverCategoryDrawerProps) {
  const { t } = useI18n();
  return (
    <DrawerRegion
      open={open}
      onClose={onClose}
      side="left"
      belowHeader
      size="wide"
      closeOnBack
      ariaLabel={t('discover_categories_aria')}
    >
      <nav aria-label={t('discover_categories_aria')} className="px-3 pb-gutter pt-3">
        {nav.status === 'loading' ? (
          <CategoryNavPendingSkeleton />
        ) : nav.status === 'error' ? (
          <p className="px-2 py-1 text-body-sm text-muted">{t('profile_categories_unavailable')}</p>
        ) : (
          <CategoryNavDrawerList
            items={nav.items}
            navLineage={nav.navLineage}
            activeLineage={activeLineage}
            rootLabel={formatObjectTypeLabel(objectType)}
            hrefFor={hrefFor}
            NavLink={DiscoverCategoryLink}
            onPick={onClose}
            showCounts
            other={otherRow(nav, other, activeLineage)}
          />
        )}
      </nav>
    </DrawerRegion>
  );
}
