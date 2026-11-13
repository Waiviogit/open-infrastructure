/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { HomeFeedFiltersView } from '../../../application/dto/home-feed-filters.dto';
import { HomeFeedFiltersPanel } from './home-feed-filters-panel';

let mockSearch = '';
const mockOpenLogin = jest.fn();

jest.mock('@/shared/presentation', () => ({
  OptimisticNavLink: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useEffectiveNav: () => ({ pathname: '/', search: mockSearch }),
  UserAvatar: () => <span data-testid="avatar" />,
  ObjectThumbnail: () => <span data-testid="thumb" />,
}));

jest.mock('@/icons', () => ({ Icon: () => null }));
jest.mock('@/modules/auth', () => ({ useLoginModal: () => ({ openLogin: mockOpenLogin }) }));
jest.mock('@/app/(app)/(hub)/(home)/home-feed.actions', () => ({
  loadMoreHomeFeedFilterUsersAction: jest.fn(),
  loadMoreHomeFeedFilterObjectsAction: jest.fn(),
}));

const messages = new Proxy({} as Messages, {
  get: (_target, key) =>
    key === 'home_feed_filter_type_toggle' ? 'Toggle {type}' : typeof key === 'string' ? key : undefined,
  has: () => true,
});

const summary: HomeFeedFiltersView = {
  tab: 'posts',
  windowHours: 72,
  windowStart: 0,
  countsAvailable: true,
  users: {
    items: [
      { name: 'alice', avatarUrl: null, count: 3 },
      { name: 'bob', avatarUrl: null, count: 0 },
    ],
    total: 2,
    hasMore: false,
  },
  objectTypes: [
    {
      objectType: 'restaurant',
      count: 0,
      total: 1,
      objects: {
        items: [{ objectId: 'cafe-1', objectType: 'restaurant', count: 0, object: null }],
        hasMore: false,
      },
    },
  ],
};

function renderPanel(props: Partial<React.ComponentProps<typeof HomeFeedFiltersPanel>> = {}) {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <HomeFeedFiltersPanel tab="posts" signedIn summary={summary} {...props} />
    </I18nProvider>,
  );
}

function activeLinks() {
  return screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
}

describe('HomeFeedFiltersPanel', () => {
  beforeEach(() => {
    mockSearch = '';
  });

  it('marks exactly one item: my feed by default for a signed-in viewer', () => {
    renderPanel();
    expect(activeLinks().map((link) => link.getAttribute('href'))).toEqual(['/']);
  });

  it('marks the author from the URL and links rows to their filters', () => {
    mockSearch = 'author=alice';
    renderPanel();

    expect(activeLinks().map((link) => link.getAttribute('href'))).toEqual(['/?author=alice']);
    expect(screen.getByRole('link', { name: /bob/ }).getAttribute('href')).toBe('/?author=bob');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Restaurant' }));
    expect(screen.getByRole('link', { name: /cafe-1/ }).getAttribute('href')).toBe('/?object=cafe-1');
  });

  it('falls back to my feed when the URL author has nothing on this tab', () => {
    mockSearch = 'author=carol';
    renderPanel({ tab: 'threads', presence: { filterKey: 'author:carol', tabs: ['posts'] } });
    expect(activeLinks().map((link) => link.getAttribute('href'))).toEqual(['/feed/threads']);
  });

  it('shows +N only for rows with new items', () => {
    renderPanel();
    const alice = screen.getByRole('link', { name: /alice/ });
    expect(within(alice).getByText('+3')).toBeTruthy();
    expect(screen.getByRole('link', { name: /bob/ }).textContent).not.toContain('+');
  });

  it('opens sections whose top row is new and collapses the rest; headers only toggle', () => {
    renderPanel();
    const people = screen.getByRole('button', { name: 'Toggle home_feed_filter_section_people' });
    const restaurants = screen.getByRole('button', { name: 'Toggle Restaurant' });

    expect(people.getAttribute('aria-expanded')).toBe('true');
    expect(restaurants.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('cafe-1')).toBeNull();

    fireEvent.click(restaurants);
    expect(restaurants.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('cafe-1')).toBeTruthy();
    expect(restaurants.tagName).toBe('BUTTON');

    fireEvent.click(people);
    expect(screen.queryByText('alice')).toBeNull();
  });

  it('shows only the sorts the tab supports', () => {
    renderPanel({ tab: 'activity' });
    expect(screen.queryByText('home_feed_filter_hot')).toBeNull();
    expect(screen.queryByText('home_feed_filter_trending')).toBeNull();
    expect(screen.getByRole('link', { name: 'home_feed_filter_new' }).getAttribute('href')).toBe(
      '/feed/activity?filter=new',
    );
  });

  it('hides Hot on Updates', () => {
    renderPanel({ tab: 'updates' });
    expect(screen.queryByText('home_feed_filter_hot')).toBeNull();
    expect(screen.getByRole('link', { name: 'home_feed_filter_trending' })).toBeTruthy();
  });

  it('guests get site-wide sorts and a sign-in prompt, defaulting to trending', () => {
    renderPanel({ signedIn: false, summary: null });

    expect(screen.queryByRole('link', { name: 'home_feed_filter_my_feed' })).toBeNull();
    expect(activeLinks().map((link) => link.getAttribute('href'))).toEqual(['/?filter=trending']);
    fireEvent.click(screen.getByRole('button', { name: 'home_feed_filters_sign_in' }));
    expect(mockOpenLogin).toHaveBeenCalled();
  });
});
