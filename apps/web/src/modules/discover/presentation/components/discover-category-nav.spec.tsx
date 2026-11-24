/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { buildDiscoverHref } from '../../domain/discover-url';
import { DiscoverCategoryBreadcrumbs, DiscoverCategoryRail } from './discover-category-nav';

jest.mock('@/shared/presentation', () => ({
  OptimisticNavLink: ({
    href,
    children,
    className,
    onClick,
    'aria-current': ariaCurrent,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    'aria-current'?: 'page';
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>
      {children}
    </a>
  ),
}));

jest.mock('@/shared/presentation/layout', () => ({
  DrawerRegion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const messages = {
  all: 'All',
  discover_categories_aria: 'Categories',
  favorites_breadcrumb_aria: 'Breadcrumb',
  profile_categories_up: '← Up',
  profile_categories_all: 'All categories',
  profile_categories_unavailable: 'Categories are unavailable',
} as Messages;

const hrefFor = (lineage: readonly string[]) =>
  buildDiscoverHref({ type: 'product', categoryPath: lineage, q: 'sony' });

function wrap(node: React.ReactNode) {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      {node}
    </I18nProvider>,
  );
}

describe('DiscoverCategoryRail', () => {
  it('lists the level with group counts, keeps filters in links and marks the active category', () => {
    wrap(
      <DiscoverCategoryRail
        objectType="product"
        nav={{
          status: 'ready',
          navLineage: ['Electronics'],
          items: [
            { name: 'Audio', objects_count: 12, has_children: true },
            { name: 'Video', objects_count: 5, has_children: false },
          ],
        }}
        categoryPath={['Electronics', 'Video']}
        activeLineage={['Electronics', 'Video']}
        hrefFor={hrefFor}
      />,
    );

    const audio = screen.getByRole('link', { name: /Audio/ });
    expect(audio).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Electronics&cat=Audio&q=sony',
    );
    expect(audio.textContent).toContain('12');
    expect(screen.getByRole('link', { name: /Video/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '← Up' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Electronics&q=sony',
    );
    expect(screen.getByRole('link', { name: 'All categories' })).toHaveAttribute(
      'href',
      '/discover?type=product&q=sony',
    );
  });

  it('shows a skeleton while loading and a message when the tree is unavailable', () => {
    const { container, rerender } = wrap(
      <DiscoverCategoryRail
        objectType="product"
        nav={{ status: 'loading', treeKnown: true }}
        categoryPath={[]}
        activeLineage={[]}
        hrefFor={hrefFor}
      />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    rerender(
      <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
        <DiscoverCategoryRail
          objectType="product"
          nav={{ status: 'error', treeKnown: true }}
          categoryPath={[]}
          activeLineage={[]}
          hrefFor={hrefFor}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Categories are unavailable')).toBeInTheDocument();
  });
});

describe('DiscoverCategoryBreadcrumbs', () => {
  it('starts at All, links every crumb but the last, and opens the drawer from the pill', () => {
    const onOpen = jest.fn();
    wrap(
      <DiscoverCategoryBreadcrumbs
        categoryPath={['Electronics', 'Audio']}
        hrefFor={hrefFor}
        drawer={{ open: false, onOpen }}
      />,
    );

    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/discover?type=product&q=sony',
    );
    expect(screen.getByRole('link', { name: 'Electronics' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Electronics&q=sony',
    );
    expect(screen.queryByRole('link', { name: 'Audio' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Audio, Categories' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
