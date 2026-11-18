/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import {
  HomeFeedActiveFilterLabelProvider,
  useReportHomeFeedActiveFilterLabel,
} from './home-feed-active-filter-label';
import { HomeFeedMobileFilters } from './home-feed-mobile-filters';

let mockSearch = '';

jest.mock('@/shared/presentation', () => ({
  useEffectiveNav: () => ({ pathname: '/', search: mockSearch }),
}));

/** The layout barrel also exports the app header (server-only deps); the drawer alone is enough. */
jest.mock('@/shared/presentation/layout', () => ({
  DrawerRegion: jest.requireActual('@/shared/presentation/layout/regions/drawer-region')
    .DrawerRegion,
}));

jest.mock('@/icons', () => ({ ChevronDownIcon: () => null }));

const messages = { home_feed_filters_aria: 'Feed filters' } as Messages;

function Rail({ label }: { label: string }) {
  useReportHomeFeedActiveFilterLabel(label);
  return <p>rail content</p>;
}

function renderFilters(rail: React.ReactNode) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <HomeFeedActiveFilterLabelProvider>
        {rail}
        <HomeFeedMobileFilters>
          <p>drawer content</p>
        </HomeFeedMobileFilters>
      </HomeFeedActiveFilterLabelProvider>
    </I18nProvider>,
  );
}

describe('HomeFeedMobileFilters', () => {
  beforeEach(() => {
    mockSearch = '';
  });

  it('names the trigger after the active filter', () => {
    renderFilters(<Rail label="My feed" />);
    expect(screen.getByRole('button', { name: 'My feed' })).toBeTruthy();
  });

  it('shows a placeholder until the rail names the filter', () => {
    renderFilters(null);
    expect(screen.getByRole('button', { name: 'Feed filters' })).toBeTruthy();
  });

  it('opens the rail in a drawer', () => {
    renderFilters(<Rail label="Trending" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trending' }));
    expect(screen.getByRole('dialog', { name: 'Feed filters' }).textContent).toContain('drawer content');
  });
});
