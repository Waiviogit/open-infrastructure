/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { ProfileShopFiltersState } from '../../domain/profile-shop-filters-url';
import { FavoritesBreadcrumbs } from './favorites-breadcrumbs';
import { FavoritesCategoryDrawerProvider } from './favorites-category-drawer';

jest.mock('next/navigation', () => ({
  usePathname: () => '/@alice/favorites/recipe/German%20Cuisine',
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
  favorites_breadcrumb_aria: 'Favorites path',
  profile_categories_uncategorized: 'Uncategorized',
  favorites_categories_aria: 'Favorites categories',
} as Messages;

const NO_FILTERS: ProfileShopFiltersState = { tags: [], rating: null };

function renderCrumbs(lineage: string[], filters: ProfileShopFiltersState = NO_FILTERS) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesBreadcrumbs
        accountName="alice"
        objectType="recipe"
        lineage={lineage}
        filters={filters}
      />
    </I18nProvider>,
  );
  return screen.getByRole('navigation', { name: 'Favorites path' });
}

describe('FavoritesBreadcrumbs', () => {
  it('renders Type › Category › Subcategory with the last crumb as the current page', () => {
    const nav = renderCrumbs(['German Cuisine', 'Comfort Food']);
    const items = within(nav).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Recipe',
      '›German Cuisine',
      '›Comfort Food',
    ]);

    expect(within(nav).getByRole('link', { name: 'Recipe' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe',
    );
    expect(within(nav).getByRole('link', { name: 'German Cuisine' })).toHaveAttribute(
      'href',
      '/@alice/favorites/recipe/German%20Cuisine',
    );
    expect(within(nav).queryByRole('link', { name: 'Comfort Food' })).toBeNull();
    expect(within(nav).getByText('Comfort Food')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps tag and rating filters on every link', () => {
    const nav = renderCrumbs(['German Cuisine', 'Comfort Food'], {
      tags: ['Cuisine:german'],
      rating: 8,
    });
    for (const link of within(nav).getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/\?tags=Cuisine%3Agerman&rating=8$/);
    }
  });

  it('hides the separators from assistive tech', () => {
    const nav = renderCrumbs(['German Cuisine']);
    const separator = within(nav).getByText('›');
    expect(separator).toHaveAttribute('aria-hidden');
  });

  it('shows only the type as the current page at the type root', () => {
    const nav = renderCrumbs([]);
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    expect(within(nav).getByText('Recipe')).toHaveAttribute('aria-current', 'page');
  });

  it('labels the Uncategorized node', () => {
    const nav = renderCrumbs(['uncategorized']);
    expect(within(nav).getByRole('link', { name: 'Recipe' })).toBeInTheDocument();
    expect(within(nav).getByText('Uncategorized')).toHaveAttribute('aria-current', 'page');
  });

  describe('category menu trigger', () => {
    function renderMenuCrumbs(categoryMenu: boolean) {
      render(
        <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
          <FavoritesCategoryDrawerProvider>
            <FavoritesBreadcrumbs
              accountName="alice"
              objectType="recipe"
              lineage={['German Cuisine']}
              filters={NO_FILTERS}
              categoryMenu={categoryMenu}
            />
          </FavoritesCategoryDrawerProvider>
        </I18nProvider>,
      );
    }

    it('turns the current crumb into the drawer button for a type with categories', () => {
      renderMenuCrumbs(true);
      const button = screen.getByRole('button', { name: 'German Cuisine, Favorites categories' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps a plain current crumb for a type without categories', () => {
      renderMenuCrumbs(false);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
