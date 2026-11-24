'use client';

import type { CategoryNavItem } from '@/shared/domain/category-nav';

import type { CategoryHrefFor, CategoryNavLink } from './category-nav.types';

export type CategoryNavListProps = {
  items: readonly CategoryNavItem[];
  /** Lineage whose children `items` are (links append the item name to it). */
  parentLineage: readonly string[];
  /** Last segment of the effective (optimistic) lineage; highlights that item. */
  activeName: string | null;
  hrefFor: CategoryHrefFor;
  NavLink: CategoryNavLink;
  /** Show each item's count next to its name. */
  showCounts?: boolean;
};

/** Desktop rail list of one category level: child categories, › when they have children. */
export function CategoryNavList({
  items,
  parentLineage,
  activeName,
  hrefFor,
  NavLink,
  showCounts = false,
}: CategoryNavListProps) {
  return (
    <ul className="mt-1 list-none space-y-0.5 p-0" role="list">
      {items.map((item) => {
        const isActive = activeName === item.name;
        return (
          <li key={item.name}>
            <NavLink
              href={hrefFor([...parentLineage, item.name])}
              className={[
                'flex items-center justify-between gap-2 rounded-btn px-2 py-1.5 text-body-sm transition-colors',
                isActive
                  ? 'bg-surface font-weight-label text-fg'
                  : 'text-muted hover:bg-surface/80 hover:text-fg',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-muted tabular-nums">
                {showCounts ? <span className="text-caption">{item.objects_count}</span> : null}
                {item.has_children ? <span aria-hidden>›</span> : null}
              </span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
