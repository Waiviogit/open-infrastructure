/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { writeDiscoverObjectTypeCookie } from '../../domain/discover-type-cookie';
import { HubDiscoverTabBand } from './hub-discover-tab-band';

let mockPathname = '/discover';
let mockSearch = 'type=product';

jest.mock('@/shared/presentation', () => ({
  MODAL_Z_INDEX_DEFAULT: 110,
  profileSectionTabClass: (active: boolean) =>
    active ? 'tab-active' : 'tab-inactive',
  useEffectiveNav: () => ({ pathname: mockPathname, search: mockSearch }),
  OptimisticNavLink: ({
    href,
    children,
    onClick,
    className,
    'aria-current': ariaCurrent,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    'aria-current'?: 'page';
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a
      href={href}
      onClick={onClick}
      className={className}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  ),
}));

jest.mock('@/shared/presentation/layout', () => ({
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS: 'row',
  ShellFullBleedBand: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ShellInset: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ScrollableHorizontalTabNav: ({
    children,
    ariaLabel,
  }: {
    children: React.ReactNode;
    ariaLabel: string;
  }) => <nav aria-label={ariaLabel}>{children}</nav>,
}));

jest.mock('../../domain/discover-type-cookie', () => ({
  writeDiscoverObjectTypeCookie: jest.fn(),
}));

const messages = {
  discover_types_nav_aria: 'Object types',
  discover_users_menu: 'Users',
  discover_more_types: 'More',
  discover_more_types_aria: 'More object types',
  discover_search_object_types: 'Search object types',
  discover_no_results: 'No results found.',
  previous: 'Previous',
  next: 'Next',
} as Messages;

function renderBand() {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <HubDiscoverTabBand />
    </I18nProvider>,
  );
}

function tabsNav() {
  return screen.getByRole('navigation', { name: 'Object types' });
}

function tabLabels(): string[] {
  return within(tabsNav())
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');
}

describe('HubDiscoverTabBand', () => {
  beforeEach(() => {
    mockPathname = '/discover';
    mockSearch = 'type=product';
    jest.mocked(writeDiscoverObjectTypeCookie).mockClear();
  });

  it('is hidden outside /discover', () => {
    mockPathname = '/feed/trending';
    renderBand();
    expect(
      screen.queryByRole('navigation', { name: 'Object types' }),
    ).not.toBeInTheDocument();
  });

  it('shows the popular types, then Users, then More', () => {
    renderBand();
    expect(tabLabels()).toEqual([
      'Product',
      'Business',
      'Restaurant',
      'Person',
      'Book',
      'Users',
    ]);
    expect(
      within(tabsNav()).getByRole('button', { name: /More/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
  });

  it('marks the active type and keeps q and sort in type links (drops tags)', () => {
    mockSearch = 'type=restaurant&q=sushi&tags=Cuisine%3AJapanese&sort=newest';
    renderBand();
    const restaurant = within(tabsNav()).getByRole('link', {
      name: 'Restaurant',
    });
    expect(restaurant).toHaveAttribute('aria-current', 'page');
    expect(
      within(tabsNav()).getByRole('link', { name: 'Book' }),
    ).toHaveAttribute('href', '/discover?type=book&q=sushi&sort=newest');
  });

  it('marks Users in users mode', () => {
    mockSearch = 'users=1';
    renderBand();
    expect(
      within(tabsNav()).getByRole('link', { name: 'Users' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(tabsNav()).getByRole('link', { name: 'Product' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('shows a type picked from More as an active tab before More', () => {
    mockSearch = 'type=recipe';
    renderBand();
    expect(tabLabels()).toEqual([
      'Product',
      'Business',
      'Restaurant',
      'Person',
      'Book',
      'Users',
      'Recipe',
    ]);
    expect(
      within(tabsNav()).getByRole('link', { name: 'Recipe' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('leaves every tab inactive for mixed search results (type=all)', () => {
    mockSearch = 'type=all&q=sushi';
    renderBand();
    for (const link of within(tabsNav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('More lists only non-popular types, filters by search and remembers the pick', () => {
    renderBand();
    fireEvent.click(within(tabsNav()).getByRole('button', { name: /More/ }));

    const more = screen.getByRole('navigation', { name: 'More object types' });
    expect(
      within(more).queryByRole('link', { name: 'Product' }),
    ).not.toBeInTheDocument();
    expect(
      within(more).getByRole('link', { name: 'Recipe' }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search object types' }),
      {
        target: { value: 'reci' },
      },
    );
    expect(
      within(more)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Recipe']);

    fireEvent.click(within(more).getByRole('link', { name: 'Recipe' }));
    expect(writeDiscoverObjectTypeCookie).toHaveBeenCalledWith('recipe');
    expect(
      screen.queryByRole('navigation', { name: 'More object types' }),
    ).not.toBeInTheDocument();
  });

  it('More closes on Escape', () => {
    renderBand();
    const trigger = within(tabsNav()).getByRole('button', { name: /More/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
