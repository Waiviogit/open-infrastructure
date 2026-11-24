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
  category_other: 'Other',
  discover_categories_aria: 'Categories',
  favorites_breadcrumb_aria: 'Breadcrumb',
  profile_categories_up: '← Up',
  profile_categories_all: 'All categories',
  profile_categories_unavailable: 'Categories are unavailable',
} as Messages;

const hrefFor = (lineage: readonly string[]) =>
  buildDiscoverHref({ type: 'product', categoryPath: lineage, q: 'sony' });
const otherHrefFor = (lineage: readonly string[]) =>
  buildDiscoverHref({ type: 'product', categoryPath: lineage, categoryOther: true, q: 'sony' });
const OTHER = { hrefFor: otherHrefFor, active: false };

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
          otherCount: 0,
        }}
        categoryPath={['Electronics', 'Video']}
        categoryOther={false}
        activeLineage={['Electronics', 'Video']}
        hrefFor={hrefFor}
        other={OTHER}
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

  it('ends the level with Other and highlights it instead of a category; Up goes to the category', () => {
    wrap(
      <DiscoverCategoryRail
        objectType="product"
        nav={{
          status: 'ready',
          navLineage: ['Women', 'Outerwear'],
          items: [{ name: 'Active & Performance', objects_count: 3, has_children: false }],
          otherCount: 3,
        }}
        categoryPath={['Women', 'Outerwear']}
        categoryOther
        activeLineage={['Women', 'Outerwear']}
        hrefFor={hrefFor}
        other={{ hrefFor: otherHrefFor, active: true }}
      />,
    );

    const other = screen.getByRole('link', { name: /Other/ });
    expect(other).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Women&cat=Outerwear&other=1&q=sony',
    );
    expect(other.textContent).toContain('3');
    expect(other).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Active & Performance/ })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: '← Up' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Women&cat=Outerwear&q=sony',
    );
  });

  it('has no Other row when every group is in a listed category', () => {
    wrap(
      <DiscoverCategoryRail
        objectType="product"
        nav={{
          status: 'ready',
          navLineage: ['Women'],
          items: [{ name: 'Outerwear', objects_count: 6, has_children: true }],
          otherCount: 0,
        }}
        categoryPath={['Women']}
        categoryOther={false}
        activeLineage={['Women']}
        hrefFor={hrefFor}
        other={OTHER}
      />,
    );

    expect(screen.queryByRole('link', { name: /Other/ })).not.toBeInTheDocument();
  });

  it('shows a skeleton while loading and a message when the tree is unavailable', () => {
    const { container, rerender } = wrap(
      <DiscoverCategoryRail
        objectType="product"
        nav={{ status: 'loading', treeKnown: true }}
        categoryPath={[]}
        categoryOther={false}
        activeLineage={[]}
        hrefFor={hrefFor}
        other={OTHER}
      />,
    );
    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    rerender(
      <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
        <DiscoverCategoryRail
          objectType="product"
          nav={{ status: 'error', treeKnown: true }}
          categoryPath={[]}
          categoryOther={false}
          activeLineage={[]}
          hrefFor={hrefFor}
          other={OTHER}
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
        categoryOther={false}
        hrefFor={hrefFor}
        otherHref={otherHrefFor(['Electronics', 'Audio'])}
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

  it('ends with an Other crumb for the Other category', () => {
    wrap(
      <DiscoverCategoryBreadcrumbs
        categoryPath={['Women', 'Outerwear']}
        categoryOther
        hrefFor={hrefFor}
        otherHref={otherHrefFor(['Women', 'Outerwear'])}
        drawer={null}
      />,
    );

    expect(screen.getByRole('link', { name: 'Outerwear' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Women&cat=Outerwear&q=sony',
    );
    expect(screen.getByText('Other')).toBeInTheDocument();
  });
});
