'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@/icons';

import { sameCategoryLineage, type CategoryNavItem } from '@/shared/domain/category-nav';

import type { CategoryHrefFor, CategoryNavLink, CategoryNavOtherRow } from './category-nav.types';

export type CategoryNavDrawerListProps = {
  items: readonly CategoryNavItem[];
  /** Lineage whose children `items` are. */
  navLineage: readonly string[];
  /** Effective (optimistic) lineage of the page, for the active row. */
  activeLineage: readonly string[];
  /** Label of the root level (the type). */
  rootLabel: string;
  hrefFor: CategoryHrefFor;
  /** Must navigate with `replace`: it takes the place of the drawer's Back entry. */
  NavLink: CategoryNavLink;
  /** Closes the drawer: picking a leaf or the level itself ends the browse. */
  onPick: () => void;
  showCounts?: boolean;
  /** The level's Other row, after the categories; null when the level has none. */
  other?: CategoryNavOtherRow | null;
};

function categoryDrawerRowClass(active: boolean): string {
  return [
    'flex w-full min-w-0 items-center justify-between gap-2 rounded-btn px-2 py-3 text-body transition-colors',
    active ? 'bg-accent-soft font-weight-label text-accent' : 'text-fg hover:bg-ghost-surface',
  ].join(' ');
}

/**
 * Mobile category drawer, one level at a time: back to the parent level, the level itself and its
 * child categories. A category with children (›) opens it and keeps the drawer on its
 * subcategories; any other pick closes the drawer.
 */
export function CategoryNavDrawerList({
  items,
  navLineage,
  activeLineage,
  rootLabel,
  hrefFor,
  NavLink,
  onPick,
  showCounts = false,
  other = null,
}: CategoryNavDrawerListProps) {
  const { t } = useI18n();
  const otherActive = other?.active === true;
  const levelActive = !otherActive && sameCategoryLineage(activeLineage, navLineage);
  const activeName =
    levelActive || otherActive ? null : (activeLineage[activeLineage.length - 1] ?? null);
  const parentLineage = navLineage.slice(0, -1);
  const parentLabel = parentLineage[parentLineage.length - 1] ?? rootLabel;
  const levelLabel = navLineage[navLineage.length - 1] ?? rootLabel;

  return (
    <div className="flex flex-col gap-1">
      {navLineage.length > 0 ? (
        <NavLink
          href={hrefFor(parentLineage)}
          className="inline-flex min-w-0 items-center gap-1 self-start rounded-btn px-2 py-1.5 text-body-sm text-fg-secondary hover:bg-ghost-surface hover:text-fg"
        >
          <ChevronLeftIcon size={16} className="shrink-0" />
          <span className="min-w-0 truncate">{parentLabel}</span>
        </NavLink>
      ) : null}

      <NavLink
        href={hrefFor(navLineage)}
        className={[
          'flex min-w-0 items-center justify-between gap-2 rounded-btn px-2 py-2 text-section font-weight-label',
          levelActive ? 'text-accent' : 'text-fg hover:bg-ghost-surface',
        ].join(' ')}
        aria-current={levelActive ? 'page' : undefined}
        onClick={onPick}
      >
        <span className="min-w-0 truncate">{levelLabel}</span>
        {levelActive ? <CheckIcon size={18} className="shrink-0" /> : null}
      </NavLink>

      <ul className="list-none divide-y divide-border p-0">
        {items.map((item) => {
          const active = activeName === item.name;
          return (
            <li key={item.name}>
              <NavLink
                href={hrefFor([...navLineage, item.name])}
                className={categoryDrawerRowClass(active)}
                aria-current={active ? 'page' : undefined}
                onClick={item.has_children ? undefined : onPick}
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="inline-flex shrink-0 items-center gap-2">
                  {showCounts ? (
                    <span className="text-caption tabular-nums text-fg-tertiary">
                      {item.objects_count}
                    </span>
                  ) : null}
                  {item.has_children ? (
                    <ChevronRightIcon size={18} className="text-fg-tertiary" />
                  ) : active ? (
                    <CheckIcon size={18} />
                  ) : null}
                </span>
              </NavLink>
            </li>
          );
        })}
        {other ? (
          <li>
            <NavLink
              href={other.href}
              className={categoryDrawerRowClass(other.active)}
              aria-current={other.active ? 'page' : undefined}
              onClick={onPick}
            >
              <span className="min-w-0 truncate">{t('category_other')}</span>
              <span className="inline-flex shrink-0 items-center gap-2">
                {showCounts ? (
                  <span className="text-caption tabular-nums text-fg-tertiary">{other.count}</span>
                ) : null}
                {other.active ? <CheckIcon size={18} /> : null}
              </span>
            </NavLink>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
