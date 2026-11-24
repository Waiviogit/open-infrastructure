/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { DiscoverMobileHeader } from './discover-mobile-header';

jest.mock('@/shared/presentation', () => ({
  profileSectionTabClass: (active: boolean) =>
    active ? 'tab-active' : 'tab-inactive',
}));

jest.mock('./discover-sort-select', () => ({
  DiscoverSortSelect: () => <div data-testid="sort-select" />,
}));

const messages = {
  discover_page_title: 'Discover',
  discover_add_filter: 'Filter',
  discover_map: 'Map',
  object_list_tab: 'List',
  discover_map_view_nav_aria: 'Discover view',
} as Messages;

function renderHeader(
  props: Partial<React.ComponentProps<typeof DiscoverMobileHeader>> = {},
) {
  const onMobileTabChange = jest.fn();
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <DiscoverMobileHeader
        usersMode={false}
        objectType="restaurant"
        q=""
        tags={[]}
        sort="rank"
        categoryPath={[]}
        box={null}
        map={null}
        showMap
        mobileTab="list"
        onMobileTabChange={onMobileTabChange}
        {...props}
      />
    </I18nProvider>,
  );
  return { onMobileTabChange };
}

describe('DiscoverMobileHeader', () => {
  it('has no page title, type picker or Filter button (those live in the band and chips row)', () => {
    renderHeader();
    expect(screen.queryByText('Discover')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Restaurant/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Filter' }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing for users mode', () => {
    renderHeader({ usersMode: true, objectType: null, showMap: false });
    expect(screen.queryByTestId('sort-select')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Discover view' }),
    ).not.toBeInTheDocument();
  });

  it('shows List / Map sub-nav for geo-capable types', () => {
    renderHeader({ objectType: 'restaurant', showMap: true });
    expect(
      screen.getByRole('navigation', { name: 'Discover view' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
  });

  it('calls onMobileTabChange when Map tab is selected', () => {
    const { onMobileTabChange } = renderHeader({
      mobileTab: 'list',
      showMap: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onMobileTabChange).toHaveBeenCalledWith('map');
  });

  it('hides List / Map sub-nav for non-geo types', () => {
    renderHeader({ objectType: 'book', showMap: false });
    expect(
      screen.queryByRole('navigation', { name: 'Discover view' }),
    ).not.toBeInTheDocument();
  });

  it('hides sort when Map tab is active', () => {
    renderHeader({ mobileTab: 'map', showMap: true });
    expect(screen.queryByTestId('sort-select')).not.toBeInTheDocument();
  });

  it('shows sort on List tab', () => {
    renderHeader({ mobileTab: 'list', showMap: true });
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });
});
