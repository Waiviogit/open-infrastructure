import type { ComponentType, ReactNode } from 'react';

export {
  categoryNavItemSchema,
  sameCategoryLineage,
  type CategoryNavItem,
} from '@/shared/domain/category-nav';

export type CategoryNavLinkProps = {
  href: string;
  className?: string;
  'aria-current'?: 'page';
  'aria-label'?: string;
  onClick?: () => void;
  children: ReactNode;
};

/**
 * Link the category navigation renders (the page's instant-navigation link). The page decides the
 * history method: Favorites pushes in the rail, every drawer link replaces (the drawer owns a Back
 * entry).
 */
export type CategoryNavLink = ComponentType<CategoryNavLinkProps>;

/** Href of a category level (`lineage` = category names from the root, empty = the root). */
export type CategoryHrefFor = (lineage: readonly string[]) => string;

/**
 * The virtual Other category of a level: its objects in none of the listed child categories.
 * Rendered as the last row, without children.
 */
export type CategoryNavOtherRow = {
  count: number;
  href: string;
  /** The page shows this Other (highlights the row instead of a category). */
  active: boolean;
};
