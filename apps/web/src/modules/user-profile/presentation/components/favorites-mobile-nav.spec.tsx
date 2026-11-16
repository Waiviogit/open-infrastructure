/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { CategoryNavData } from '../../domain/types/category-nav';
import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import { FavoritesMobileNav, type FavoritesMobileNavProps } from './favorites-mobile-nav';

let mockPathname = '/@alice/favorites/recipe';

jest.mock('./user-profile-pending-nav-context', () => ({
  useEffectiveProfileNav: () => ({ pathname: mockPathname, search: '' }),
}));

jest.mock('./user-profile-nav-link', () => ({
  UserProfileNavLink: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const messages = {
  favorites_categories_aria: 'Favorites categories',
  profile_categories_uncategorized: 'Uncategorized',
} as Messages;

const ITEMS: FavoritesTypeSummary[] = [
  { objectType: 'recipe', objectsCount: 12, hasCategories: true },
  { objectType: 'place', objectsCount: 3, hasCategories: false },
];

const RECIPE_NAV: CategoryNavData = {
  items: [{ name: 'Desserts', objects_count: 2, has_children: false }],
  uncategorized_count: 4,
  show_other: false,
};

function renderNav(overrides: Partial<FavoritesMobileNavProps> = {}): HTMLElement | null {
  const props: FavoritesMobileNavProps = {
    accountName: 'alice',
    items: ITEMS,
    objectType: 'recipe',
    lineage: [],
    navData: RECIPE_NAV,
    filters: { tags: [], rating: 8 },
    ...overrides,
  };
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesMobileNav {...props} />
    </I18nProvider>,
  );
  return screen.queryByRole('navigation', { name: 'Favorites categories' });
}

describe('FavoritesMobileNav', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
  });

  it('shows category chips (with filters) and Uncategorized, but no type chips', () => {
    const nav = renderNav() as HTMLElement;
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/@alice/favorites/recipe/Desserts?rating=8',
      '/@alice/favorites/recipe/uncategorized?rating=8',
    ]);
  });

  it('renders nothing for a type without categories', () => {
    mockPathname = '/@alice/favorites/place';
    expect(renderNav({ objectType: 'place', navData: null })).toBeNull();
  });
});
