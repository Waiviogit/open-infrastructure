/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { CategoryNavData } from '../../domain/types/category-nav';
import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import { FavoritesRailPanel, type FavoritesRailPanelProps } from './favorites-rail-panel';

let mockPathname = '/@alice/favorites/recipe';
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('./user-profile-pending-nav-context', () => ({
  useEffectiveProfileNav: () => ({ pathname: mockPathname, search: mockSearch }),
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
  profile_categories_up: '← Up',
  profile_categories_all: 'All categories',
  profile_categories_uncategorized: 'Uncategorized',
  profile_categories_unavailable: 'Categories unavailable.',
} as Messages;

const ITEMS: FavoritesTypeSummary[] = [
  { objectType: 'recipe', objectsCount: 12, hasCategories: true },
  { objectType: 'place', objectsCount: 3, hasCategories: false },
  { objectType: 'book', objectsCount: null, hasCategories: true },
];

const RECIPE_NAV: CategoryNavData = {
  items: [
    { name: 'German Cuisine', objects_count: 5, has_children: true },
    { name: 'Desserts', objects_count: 2, has_children: false },
  ],
  uncategorized_count: 4,
  show_other: false,
};

function renderPanel(overrides: Partial<FavoritesRailPanelProps> = {}): HTMLElement | null {
  const props: FavoritesRailPanelProps = {
    accountName: 'alice',
    items: ITEMS,
    serverObjectType: 'recipe',
    lineageSegments: [],
    navData: RECIPE_NAV,
    navLineage: [],
    ...overrides,
  };
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesRailPanel {...props} />
    </I18nProvider>,
  );
  return screen.queryByRole('navigation', { name: 'Favorites categories' });
}

function renderRail(overrides: Partial<FavoritesRailPanelProps> = {}): HTMLElement {
  const nav = renderPanel(overrides);
  expect(nav).not.toBeNull();
  return nav as HTMLElement;
}

describe('FavoritesRailPanel', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
    mockSearch = '';
  });

  it('shows only the category nav of the active type, headed by the type label', () => {
    const nav = renderRail();
    expect(within(nav).getByText('Recipe')).toBeInTheDocument();
    expect(within(nav).queryByText('Place')).toBeNull();
    expect(within(nav).getByRole('link', { name: /German Cuisine/ })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/German%20Cuisine',
    );
    expect(within(nav).getByRole('link', { name: 'Uncategorized' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/uncategorized',
    );
  });

  it('keeps filters on category links', () => {
    mockSearch = 'rating=8';
    const nav = renderRail();
    expect(within(nav).getByRole('link', { name: /Desserts/ })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/Desserts?rating=8',
    );
  });

  it('scrolls with the page: the rail is not sticky and has no own scroll', () => {
    const nav = renderRail();
    expect(nav.className).not.toMatch(/sticky/);
    expect(nav.className).not.toMatch(/overflow-y-auto/);
    expect(nav.className).not.toMatch(/max-h-/);
  });

  it('renders nothing for a type without categories', () => {
    mockPathname = '/@alice/favorites/place';
    expect(renderPanel({ serverObjectType: 'place', navData: null })).toBeNull();
  });

  it('renders nothing for a category type with nothing categorized yet', () => {
    mockPathname = '/@alice/favorites/book';
    expect(
      renderPanel({
        items: [
          { objectType: 'recipe', objectsCount: 12, hasCategories: true },
          { objectType: 'book', objectsCount: 7, hasCategories: false },
        ],
        serverObjectType: 'book',
        navData: null,
      }),
    ).toBeNull();
  });

  it('hides a lone Uncategorized when the category root lists no categories', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderRail({
      serverObjectType: 'book',
      navData: { items: [], uncategorized_count: 7, show_other: false },
    });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
  });

  it('shows a skeleton when another category type is picked, until the server catches up', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderRail();
    expect(within(nav).getByText('Book')).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /German Cuisine/ })).toBeNull();
    expect(nav.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('empties at once when a type without categories is picked', () => {
    mockPathname = '/@alice/favorites/place';
    expect(renderPanel()).toBeNull();
  });

  it('highlights the open category and offers Up / All categories on a drill-down', () => {
    mockPathname = '/@alice/favorites/recipe/German%20Cuisine/Desserts';
    const nav = renderRail({
      lineageSegments: ['German Cuisine', 'Desserts'],
      navLineage: ['German Cuisine'],
    });
    expect(within(nav).getByRole('link', { name: /Desserts/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: '← Up' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/German%20Cuisine',
    );
    expect(within(nav).getByRole('link', { name: 'All categories' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe',
    );
  });

  it('uses the first type on bare /favorites', () => {
    mockPathname = '/@alice/favorites';
    const nav = renderRail();
    expect(within(nav).getByText('Recipe')).toBeInTheDocument();
  });

  it('renders nothing without types', () => {
    expect(renderPanel({ items: [], serverObjectType: null, navData: null })).toBeNull();
  });
});
