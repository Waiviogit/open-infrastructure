/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { HomeFeedMenu } from './home-feed-menu';

let mockPathname = '/';

jest.mock('@/shared/presentation', () => ({
  OptimisticNavLink: ({
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
  useEffectiveNav: () => ({ pathname: mockPathname, search: '' }),
  profileSectionTabClass: (active: boolean) => (active ? 'tab active' : 'tab'),
  profileSectionVerticalLinkClass: (active: boolean) => (active ? 'link active' : 'link'),
}));

jest.mock('@/shared/presentation/layout', () => ({
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS: 'row',
  horizontalTabNavScrollShellClass: () => 'scroll',
}));

const messages = {
  home_feed_menu_aria: 'Feed sections',
  home_feed_tab_posts: 'Posts',
  home_feed_tab_activity: 'Activity',
  home_feed_tab_threads: 'Threads',
  home_feed_tab_updates: 'Updates',
} as Messages;

function renderMenu(orientation: 'vertical' | 'horizontal') {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <HomeFeedMenu orientation={orientation} />
    </I18nProvider>,
  );
}

describe('HomeFeedMenu', () => {
  it('links every tab in order', () => {
    mockPathname = '/';
    renderMenu('vertical');

    const nav = screen.getByRole('navigation', { name: 'Feed sections' });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Posts', '/'],
      ['Threads', '/feed/threads'],
      ['Activity', '/feed/activity'],
      ['Updates', '/feed/updates'],
    ]);
  });

  it('marks the tab of the current path as the current page', () => {
    mockPathname = '/feed/threads';
    renderMenu('horizontal');

    expect(screen.getByRole('link', { name: 'Threads' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Posts' })).not.toHaveAttribute('aria-current');
  });
});
