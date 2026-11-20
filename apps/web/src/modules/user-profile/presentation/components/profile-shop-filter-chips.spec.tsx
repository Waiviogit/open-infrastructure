/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { ProfileShopFilterChips } from './profile-shop-filter-chips';

jest.mock('next/navigation', () => ({
  usePathname: () => '/@alice/favorites/recipe',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/shared/presentation', () => ({
  useInstantNavigation: () => ({ navigateInstant: jest.fn() }),
}));

const messages = {
  profile_active_filters: 'Active filters ({count})',
  profile_clear_all_filters: 'Clear all',
  profile_rating_filter_chip: '{stars}+ stars',
  profile_remove_rating_filter: 'Remove rating filter',
  discover_remove_filter: 'Remove {tag}',
} as Messages;

const FILTER_BUTTON = <button type="button">Filter</button>;

function renderChips(filters: { tags: string[]; rating: number | null }) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <ProfileShopFilterChips filters={filters} filterButton={FILTER_BUTTON} />
    </I18nProvider>,
  );
}

describe('ProfileShopFilterChips', () => {
  it('puts the Filter button after the active chips, in the same row', () => {
    renderChips({ tags: ['Cuisine:german'], rating: 8 });
    const filter = screen.getByRole('button', { name: 'Filter' });
    const row = filter.parentElement;
    expect(row?.lastElementChild).toBe(filter);
    expect(row?.textContent).toContain('Cuisine: german');
    expect(row?.textContent).toContain('4+ stars');
  });

  it('renders the Filter button alone when no filter is active', () => {
    renderChips({ tags: [], rating: null });
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
    expect(screen.queryByText('Clear all')).toBeNull();
  });
});
