/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { CategoryNavData } from '../../domain/types/category-nav';
import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import {
  FavoritesCategoryDrawer,
  FavoritesCategoryDrawerProvider,
  useFavoritesCategoryDrawerState,
} from './favorites-category-drawer';
import { FavoritesRailPanel, type FavoritesRailPanelProps } from './favorites-rail-panel';

let mockPathname = '/@alice/favorites/recipe';
let mockSearch = '';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('./user-profile-pending-nav-context', () => ({
  useEffectiveProfileNav: () => ({ pathname: mockPathname, search: mockSearch }),
}));

/** The layout barrel also exports the app header (server-only deps); the drawer alone is enough. */
jest.mock('@/shared/presentation/layout', () => ({
  DrawerRegion: jest.requireActual('@/shared/presentation/layout/regions/drawer-region')
    .DrawerRegion,
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
  category_other: 'Other',
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
  other_count: 4,
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
    expect(within(nav).getByRole('link', { name: 'Other' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe?other=1',
    );
  });

  it('highlights Other on the Other page and leads Up to its category', () => {
    mockPathname = '/@alice/favorites/recipe/German%20Cuisine';
    mockSearch = 'other=1';
    const nav = renderRail({
      lineageSegments: ['German Cuisine'],
      navLineage: ['German Cuisine'],
      navData: {
        items: [{ name: 'Stews', objects_count: 3, has_children: false }],
        uncategorized_count: 0,
        show_other: false,
        other_count: 2,
      },
    });
    const other = within(nav).getByRole('link', { name: 'Other' });
    expect(other).toHaveAttribute('aria-current', 'page');
    expect(other).toHaveAttribute('href', '/@alice/favorites/recipe/German%20Cuisine?other=1');
    expect(within(nav).getByRole('link', { name: /Stews/ })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: '← Up' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/German%20Cuisine',
    );
  });

  it('treats the legacy /uncategorized link as the root Other', () => {
    mockPathname = '/@alice/favorites/recipe/uncategorized';
    const nav = renderRail({ lineageSegments: ['uncategorized'], navLineage: [] });
    expect(within(nav).getByRole('link', { name: 'Other' })).toHaveAttribute('aria-current', 'page');
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

  it('hides a lone Other when the category root lists no categories', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderRail({
      serverObjectType: 'book',
      navData: { items: [], uncategorized_count: 7, show_other: false, other_count: 7 },
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

  describe('in the mobile category drawer', () => {
    function OpenDrawerButton() {
      const drawer = useFavoritesCategoryDrawerState();
      return (
        <button type="button" onClick={drawer?.openDrawer}>
          open categories
        </button>
      );
    }

    function renderDrawer(overrides: Partial<FavoritesRailPanelProps> = {}): HTMLElement {
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
          <FavoritesCategoryDrawerProvider>
            <OpenDrawerButton />
            <FavoritesCategoryDrawer>
              <FavoritesRailPanel {...props} />
            </FavoritesCategoryDrawer>
          </FavoritesCategoryDrawerProvider>
        </I18nProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'open categories' }));
      return screen.getByRole('dialog', { name: 'Favorites categories' });
    }

    it('lists one level: the type as the current level, categories with › and Other', () => {
      const drawer = renderDrawer();
      expect(within(drawer).getByRole('link', { name: 'Recipe' })).toHaveAttribute('aria-current', 'page');
      expect(within(drawer).getByRole('link', { name: 'German Cuisine' })).toHaveAttribute(
        'href',
        '/@alice/favorites/recipe/German%20Cuisine',
      );
      expect(within(drawer).getByRole('link', { name: 'Other' })).toHaveAttribute(
        'href',
        '/@alice/favorites/recipe?other=1',
      );
      expect(within(drawer).queryByRole('link', { name: '← Up' })).toBeNull();
    });

    it('stays open on a category with children and closes on a leaf', () => {
      const drawer = renderDrawer();
      fireEvent.click(within(drawer).getByRole('link', { name: 'German Cuisine' }));
      expect(screen.getByRole('dialog', { name: 'Favorites categories' })).toBeInTheDocument();

      fireEvent.click(within(drawer).getByRole('link', { name: 'Desserts' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('drilled into a category: back to the parent level, the level, the open leaf marked', () => {
      mockPathname = '/@alice/favorites/recipe/German%20Cuisine/Desserts';
      const drawer = renderDrawer({
        lineageSegments: ['German Cuisine', 'Desserts'],
        navLineage: ['German Cuisine'],
        navData: {
          items: [
            { name: 'Desserts', objects_count: 2, has_children: false },
            { name: 'Soups', objects_count: 3, has_children: false },
          ],
          uncategorized_count: 4,
          show_other: false,
          other_count: 0,
        },
      });
      expect(within(drawer).getByRole('link', { name: 'Recipe' })).toHaveAttribute(
        'href',
        '/@alice/favorites/recipe',
      );
      const level = within(drawer).getByRole('link', { name: 'German Cuisine' });
      expect(level).toHaveAttribute('href', '/@alice/favorites/recipe/German%20Cuisine');
      expect(level).not.toHaveAttribute('aria-current');
      expect(within(drawer).getByRole('link', { name: 'Desserts' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(drawer).queryByRole('link', { name: 'Other' })).toBeNull();
    });

    it('shows a skeleton while a newly opened category level loads', () => {
      mockPathname = '/@alice/favorites/recipe/German%20Cuisine';
      const drawer = renderDrawer();
      expect(within(drawer).queryByRole('link')).toBeNull();
      expect(drawer.querySelector('.animate-pulse')).not.toBeNull();
    });
  });
});
