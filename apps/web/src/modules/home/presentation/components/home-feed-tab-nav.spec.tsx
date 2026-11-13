/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { HomeFeedTabNav } from './home-feed-tab-nav';

let mockNav = { pathname: '/', search: '' };

jest.mock('@/shared/presentation', () => ({
  OptimisticNavLink: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useEffectiveNav: () => mockNav,
  profileSectionTabClass: (active: boolean) => (active ? 'tab active' : 'tab'),
}));

jest.mock('@/shared/presentation/layout', () => ({
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS: 'row',
  ScrollableHorizontalTabNav: ({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) => (
    <nav aria-label={ariaLabel}>{children}</nav>
  ),
}));

const messages = {
  home_feed_menu_aria: 'Feed sections',
  home_feed_tab_posts: 'Posts',
  home_feed_tab_activity: 'Activity',
  home_feed_tab_threads: 'Threads',
  home_feed_tab_updates: 'Updates',
  previous: 'Previous',
  next: 'Next',
} as Messages;

function renderNav() {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <HomeFeedTabNav />
    </I18nProvider>,
  );
  const nav = screen.getByRole('navigation', { name: 'Feed sections' });
  return Array.from(nav.querySelectorAll('a'));
}

describe('HomeFeedTabNav', () => {
  it('links every tab in order and marks the current one', () => {
    mockNav = { pathname: '/feed/threads', search: '' };

    const links = renderNav();

    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Posts', '/'],
      ['Threads', '/feed/threads'],
      ['Activity', '/feed/activity'],
      ['Updates', '/feed/updates'],
    ]);
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[0].getAttribute('aria-current')).toBeNull();
  });

  it('carries the rail filter to every tab and drops unrelated params', () => {
    mockNav = { pathname: '/', search: 'filter=hot&utm_source=x' };

    const hrefs = renderNav().map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/?filter=hot',
      '/feed/threads?filter=hot',
      '/feed/activity?filter=hot',
      '/feed/updates?filter=hot',
    ]);
  });

  it('carries an author filter', () => {
    mockNav = { pathname: '/feed/updates', search: 'author=alice' };

    expect(renderNav()[0].getAttribute('href')).toBe('/?author=alice');
  });
});
