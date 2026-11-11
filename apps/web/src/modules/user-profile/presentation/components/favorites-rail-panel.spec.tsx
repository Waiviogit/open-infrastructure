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

jest.mock('@/shared/presentation/layout', () => ({
  PROFILE_RAIL_STICKY_CLASS: 'sticky',
}));

const messages = {
  favorites: 'Favorites',
  favorites_types_empty: 'No favorite object types yet.',
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

function renderPanel(overrides: Partial<FavoritesRailPanelProps> = {}) {
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
  return screen.getByRole('navigation', { name: 'Favorites' });
}

function typeLink(nav: HTMLElement, label: RegExp): HTMLElement {
  return within(nav).getByRole('link', { name: label });
}

describe('FavoritesRailPanel', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
    mockSearch = '';
  });

  it('lists types with counts; type links drop filters', () => {
    mockSearch = 'tags=Cuisine%3Agerman';
    const nav = renderPanel();
    expect(typeLink(nav, /^Recipe/)).toHaveAttribute('href', '/@alice/favorites/recipe');
    expect(typeLink(nav, /^Recipe/)).toHaveTextContent('12');
    expect(typeLink(nav, /^Place/)).toHaveAttribute('href', '/@alice/favorites/place');
    expect(typeLink(nav, /^Book/)).toHaveTextContent(/^Book$/);
  });

  it('expands only the active category type and renders its category nav', () => {
    const nav = renderPanel();
    const recipe = typeLink(nav, /^Recipe/);
    expect(recipe).toHaveAttribute('aria-expanded', 'true');
    expect(recipe).toHaveAttribute('aria-current', 'page');
    expect(typeLink(nav, /^Book/)).toHaveAttribute('aria-expanded', 'false');
    expect(typeLink(nav, /^Place/)).not.toHaveAttribute('aria-expanded');

    const panel = document.getElementById(recipe.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    const category = within(panel as HTMLElement).getByRole('link', { name: /German Cuisine/ });
    expect(category).toHaveAttribute('href', '/@alice/favorites/recipe/German%20Cuisine');
    expect(
      within(panel as HTMLElement).getByRole('link', { name: 'Uncategorized' }),
    ).toHaveAttribute('href', '/@alice/favorites/recipe/uncategorized');
  });

  it('keeps filters on category links', () => {
    mockSearch = 'rating=8';
    const nav = renderPanel();
    expect(within(nav).getByRole('link', { name: /Desserts/ })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/Desserts?rating=8',
    );
  });

  it('treats a category type with nothing categorized as a plain type (no chevron, no panel)', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderPanel({
      items: [
        { objectType: 'recipe', objectsCount: 12, hasCategories: true },
        { objectType: 'book', objectsCount: 7, hasCategories: false },
      ],
      serverObjectType: 'book',
      navData: null,
    });
    const book = typeLink(nav, /^Book/);
    expect(book).toHaveAttribute('aria-current', 'page');
    expect(book).not.toHaveAttribute('aria-expanded');
    expect(book.querySelector('svg')).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Uncategorized' })).toBeNull();
  });

  it('hides a lone Uncategorized when the category root lists no categories', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderPanel({
      serverObjectType: 'book',
      navData: { items: [], uncategorized_count: 7, show_other: false },
    });
    const panel = document.getElementById(
      typeLink(nav, /^Book/).getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
  });

  it('switches the expanded type optimistically and shows a skeleton until the server catches up', () => {
    mockPathname = '/@alice/favorites/book';
    const nav = renderPanel();
    const book = typeLink(nav, /^Book/);
    expect(book).toHaveAttribute('aria-expanded', 'true');
    expect(typeLink(nav, /^Recipe/)).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: /German Cuisine/ })).toBeNull();
    const panel = document.getElementById(book.getAttribute('aria-controls') ?? '');
    expect(panel?.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('collapses category nav when a type without categories is active', () => {
    mockPathname = '/@alice/favorites/place';
    const nav = renderPanel({ serverObjectType: 'place', navData: null });
    expect(typeLink(nav, /^Place/)).toHaveAttribute('aria-current', 'page');
    expect(typeLink(nav, /^Recipe/)).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: /German Cuisine/ })).toBeNull();
  });

  it('highlights the open category and offers Up / All categories on a drill-down', () => {
    mockPathname = '/@alice/favorites/recipe/German%20Cuisine/Desserts';
    const nav = renderPanel({
      lineageSegments: ['German Cuisine', 'Desserts'],
      navLineage: ['German Cuisine'],
    });
    expect(typeLink(nav, /^Recipe/)).toHaveAttribute('aria-current', 'true');
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

  it('shows the first type as active on bare /favorites', () => {
    mockPathname = '/@alice/favorites';
    const nav = renderPanel();
    expect(typeLink(nav, /^Recipe/)).toHaveAttribute('aria-current', 'page');
  });

  it('shows the empty state without types', () => {
    renderPanel({ items: [], serverObjectType: null, navData: null });
    expect(screen.getByText('No favorite object types yet.')).toBeInTheDocument();
  });
});
