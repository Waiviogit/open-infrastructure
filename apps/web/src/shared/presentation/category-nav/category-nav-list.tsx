'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { CategoryNavItem } from '@/shared/domain/category-nav';

import type { CategoryHrefFor, CategoryNavLink, CategoryNavOtherRow } from './category-nav.types';

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
  /** The level's Other row, after the categories; null when the level has none. */
  other?: CategoryNavOtherRow | null;
};

function railRowClass(active: boolean): string {
  return [
    'flex items-center justify-between gap-2 rounded-btn px-2 py-1.5 text-body-sm transition-colors',
    active ? 'bg-surface font-weight-label text-fg' : 'text-muted hover:bg-surface/80 hover:text-fg',
  ].join(' ');
}

/** Desktop rail list of one category level: child categories, › when they have children. */
export function CategoryNavList({
  items,
  parentLineage,
  activeName,
  hrefFor,
  NavLink,
  showCounts = false,
  other = null,
}: CategoryNavListProps) {
  const { t } = useI18n();
  return (
    <ul className="mt-1 list-none space-y-0.5 p-0" role="list">
      {items.map((item) => {
        const isActive = other?.active !== true && activeName === item.name;
        return (
          <li key={item.name}>
            <NavLink
              href={hrefFor([...parentLineage, item.name])}
              className={railRowClass(isActive)}
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
      {other ? (
        <li>
          <NavLink
            href={other.href}
            className={railRowClass(other.active)}
            aria-current={other.active ? 'page' : undefined}
          >
            <span className="min-w-0 truncate">{t('category_other')}</span>
            {showCounts ? (
              <span className="shrink-0 text-caption text-muted tabular-nums">{other.count}</span>
            ) : null}
          </NavLink>
        </li>
      ) : null}
    </ul>
  );
}
