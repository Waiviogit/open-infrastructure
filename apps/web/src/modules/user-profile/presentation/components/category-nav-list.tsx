'use client';

import { buildFavoritesPath } from '../../domain/favorites-path';
import {
  buildProfileShopHref,
  type ProfileShopFiltersState,
} from '../../domain/profile-shop-filters-url';
import type { CategoryNavItem } from '../../domain/types/category-nav';
import { UserProfileNavLink } from './user-profile-nav-link';

type CategoryNavListProps = {
  items: CategoryNavItem[];
  accountName: string;
  objectType: string;
  /** Lineage whose children `items` are (links append the item name to it). */
  parentLineage: readonly string[];
  /** Last segment of the effective (optimistic) lineage; highlights that item. */
  activeName: string | null;
  filters: ProfileShopFiltersState;
};

export function CategoryNavList({
  items,
  accountName,
  objectType,
  parentLineage,
  activeName,
  filters,
}: CategoryNavListProps) {
  return (
    <ul className="mt-1 list-none space-y-0.5 p-0" role="list">
      {items.map((item) => {
        const href = buildProfileShopHref(
          buildFavoritesPath(accountName, objectType, [...parentLineage, item.name]),
          filters,
        );
        const isActive = activeName === item.name;
        return (
          <li key={item.name}>
            <UserProfileNavLink
              href={href}
              className={[
                'flex items-center justify-between gap-2 rounded-btn px-2 py-1.5 text-body-sm transition-colors',
                isActive
                  ? 'bg-surface font-weight-label text-fg'
                  : 'text-muted hover:bg-surface/80 hover:text-fg',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="min-w-0 truncate">{item.name}</span>
              {item.has_children ? (
                <span className="shrink-0 text-muted tabular-nums" aria-hidden>
                  ›
                </span>
              ) : null}
            </UserProfileNavLink>
          </li>
        );
      })}
    </ul>
  );
}
