/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import {
  FavoritesFilterSheet,
  FavoritesFilterSheetProvider,
  FavoritesMobileFilterButton,
} from './favorites-filter-sheet';

const mockNavigateInstant = jest.fn();
let mockPathname = '/@alice/favorites/recipe';

let mockSearch = '';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('@/shared/presentation', () => {
  const sheet = jest.requireActual('@/shared/presentation/components/mobile-filter-sheet');
  return {
    MobileFilterButton: sheet.MobileFilterButton,
    MobileFilterSheet: sheet.MobileFilterSheet,
    useInstantNavigation: () => ({ navigateInstant: mockNavigateInstant }),
  };
});

jest.mock('@/shared/presentation/components/modal-shell', () => ({
  ModalShell: ({
    open,
    header,
    footer,
    children,
  }: {
    open: boolean;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        {header}
        {children}
        {footer}
      </div>
    ) : null,
}));

jest.mock('./profile-shop-filters', () => ({
  ProfileFavoritesFiltersFromUrl: ({ variant }: { variant: string }) => (
    <p>facets ({variant})</p>
  ),
}));

const messages = {
  discover_add_filter: 'Filter',
  discover_filters_title: 'Filters',
  discover_clear: 'Clear',
  discover_show_results: 'Show results',
} as Messages;

function renderSheet(objectType: string) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesFilterSheetProvider>
        <FavoritesMobileFilterButton objectType={objectType} />
        <FavoritesFilterSheet accountName="alice" />
      </FavoritesFilterSheetProvider>
    </I18nProvider>,
  );
}

describe('Favorites mobile filters', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
    mockNavigateInstant.mockClear();
  });

  it('opens the right rail facets in a sheet from the Filter button', () => {
    renderSheet('recipe');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('dialog').textContent).toContain('facets (sheet)');
  });

  it('clears filters on the current path and closes on Show results', () => {
    mockPathname = '/@alice/favorites/recipe/Desserts';
    renderSheet('recipe');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(mockNavigateInstant).toHaveBeenCalledWith({
      href: '/@alice/favorites/recipe/Desserts',
      method: 'replace',
      scroll: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show results' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the Other category when clearing filters', () => {
    mockPathname = '/@alice/favorites/recipe/Desserts';
    mockSearch = 'other=1&rating=8';
    renderSheet('recipe');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(mockNavigateInstant).toHaveBeenCalledWith({
      href: '/@alice/favorites/recipe/Desserts?other=1',
      method: 'replace',
      scroll: false,
    });
    mockSearch = '';
  });

  it('shows no Filter button for a type without rating or tag facets', () => {
    renderSheet('type-without-registry-entry');
    expect(screen.queryByRole('button', { name: 'Filter' })).toBeNull();
  });
});
