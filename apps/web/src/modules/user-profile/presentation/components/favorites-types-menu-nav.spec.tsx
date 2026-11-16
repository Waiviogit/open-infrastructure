/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { FavoritesTypeSummary } from '../../domain/types/favorites';
import { FavoritesTypesMenuNav } from './favorites-types-menu-nav';

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

jest.mock('@/shared/presentation/layout/scrollable-horizontal-tab-nav', () => ({
  ScrollableHorizontalTabNav: ({
    ariaLabel,
    children,
  }: {
    ariaLabel: string;
    children: React.ReactNode;
  }) => <nav aria-label={ariaLabel}>{children}</nav>,
}));

const messages = {
  user_profile_submenu_favorites_aria: 'Favorites types',
  previous: 'Previous',
  next: 'Next',
} as Messages;

const ITEMS: FavoritesTypeSummary[] = [
  { objectType: 'recipe', objectsCount: 12, hasCategories: true },
  { objectType: 'place', objectsCount: 3, hasCategories: false },
  { objectType: 'book', objectsCount: null, hasCategories: true },
];

function renderMenu(items: readonly FavoritesTypeSummary[] = ITEMS) {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesTypesMenuNav accountName="alice" items={items} />
    </I18nProvider>,
  );
}

function typeTab(label: RegExp): HTMLElement {
  const menu = screen.getByRole('navigation', { name: 'Favorites types' });
  return within(menu).getByRole('link', { name: label });
}

describe('FavoritesTypesMenuNav', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
  });

  it('lists every type with its count; type links carry no filters or category', () => {
    renderMenu();
    const menu = screen.getByRole('navigation', { name: 'Favorites types' });
    const links = within(menu).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/@alice/favorites/recipe',
      '/@alice/favorites/place',
      '/@alice/favorites/book',
    ]);
    expect(links[0]).toHaveTextContent('Recipe12');
    expect(links[2]).toHaveTextContent(/^Book$/);
  });

  it('marks the type of the effective path active', () => {
    mockPathname = '/@alice/favorites/place';
    renderMenu();
    expect(typeTab(/^Place/)).toHaveAttribute('aria-current', 'true');
    expect(typeTab(/^Recipe/)).not.toHaveAttribute('aria-current');
  });

  it('keeps the type active on a category drill-down', () => {
    mockPathname = '/@alice/favorites/recipe/German%20Cuisine';
    renderMenu();
    expect(typeTab(/^Recipe/)).toHaveAttribute('aria-current', 'true');
  });

  it('marks the first type active on bare /favorites', () => {
    mockPathname = '/@alice/favorites';
    renderMenu();
    expect(typeTab(/^Recipe/)).toHaveAttribute('aria-current', 'true');
  });

  it('renders nothing without types', () => {
    const { container } = renderMenu([]);
    expect(container).toBeEmptyDOMElement();
  });
});
