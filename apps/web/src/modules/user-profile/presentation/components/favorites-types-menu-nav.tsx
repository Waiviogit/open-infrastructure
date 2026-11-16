'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { profileSectionTabClass } from '@/shared/presentation/components/profile-section-tab-classes';
import { HORIZONTAL_TAB_NAV_SUB_ROW_CLASS } from '@/shared/presentation/layout/horizontal-tab-nav-classes';
import { ScrollableHorizontalTabNav } from '@/shared/presentation/layout/scrollable-horizontal-tab-nav';

import { buildFavoritesPath, parseFavoritesPath } from '../../domain/favorites-path';
import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import { formatFavoritesTypeLabel } from './favorites-type-label';
import { PROFILE_SUBMENU_CARD_CLASS } from './profile-submenu-classes';
import { useEffectiveProfileNav } from './user-profile-pending-nav-context';
import { UserProfileNavLink } from './user-profile-nav-link';

export type FavoritesTypesMenuNavProps = {
  accountName: string;
  /** Favorites types of the account (count desc). */
  items: readonly FavoritesTypeSummary[];
};

/**
 * Horizontal menu of the user's Favorites types, in the profile submenu card (same look as the
 * wallet tabs). The active tab follows the optimistic pathname; bare `/favorites` shows the
 * first type. Type links drop tag/rating filters.
 */
export function FavoritesTypesMenuNav({ accountName, items }: FavoritesTypesMenuNavProps) {
  const { t } = useI18n();
  const { pathname } = useEffectiveProfileNav();

  if (items.length === 0) {
    return null;
  }

  const activeType = parseFavoritesPath(pathname)?.objectType ?? items[0]?.objectType ?? null;

  return (
    <div className={PROFILE_SUBMENU_CARD_CLASS}>
      <ScrollableHorizontalTabNav
        ariaLabel={t('user_profile_submenu_favorites_aria')}
        rowClass={HORIZONTAL_TAB_NAV_SUB_ROW_CLASS}
        bleed="card"
        activeItemSelector="nav a.text-accent"
        scrollPrevAriaLabel={t('previous')}
        scrollNextAriaLabel={t('next')}
      >
        {items.map(({ objectType, objectsCount }) => {
          const active = objectType === activeType;
          return (
            <UserProfileNavLink
              key={objectType}
              href={buildFavoritesPath(accountName, objectType)}
              className={profileSectionTabClass(active, 'sub')}
              aria-current={active ? 'true' : undefined}
            >
              <span className="inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap">
                <span>{formatFavoritesTypeLabel(objectType)}</span>
                {objectsCount != null ? (
                  <span className="shrink-0 text-caption tabular-nums text-fg-secondary">
                    {objectsCount}
                  </span>
                ) : null}
              </span>
            </UserProfileNavLink>
          );
        })}
      </ScrollableHorizontalTabNav>
    </div>
  );
}
