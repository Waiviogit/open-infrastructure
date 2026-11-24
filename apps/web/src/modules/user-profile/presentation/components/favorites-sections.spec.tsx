/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { ShopSectionsPage } from '../../domain/types/shop-objects';
import { FavoritesSections } from './favorites-sections';

jest.mock('@/app/(app)/user-profile/[name]/favorites-feed.actions', () => ({
  loadMoreFavoritesSectionsAction: jest.fn(),
}));

jest.mock('@/modules/auth', () => ({
  useLoginModal: () => ({ openLogin: jest.fn() }),
}));

jest.mock('@/shared/presentation', () => ({
  useInfiniteScroll: () => ({ sentinelRef: { current: null } }),
  useSyncedPaginatedList: jest.requireActual('@/shared/presentation/hooks/use-synced-paginated-list')
    .useSyncedPaginatedList,
}));

jest.mock('@/shared/presentation/layout', () => ({
  FeedColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/modules/feed/presentation', () => ({
  CategorySectionCard: ({
    title,
    href,
    totalObjects,
  }: {
    title: string;
    href: string;
    totalObjects: number;
  }) => (
    <section data-testid="section">
      <a href={href}>{title}</a> {totalObjects}
    </section>
  ),
}));

jest.mock('./user-profile-nav-link', () => ({
  UserProfileNavLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const messages = {
  category_other: 'Other',
  profile_shop_load_more_sections: 'Load more sections',
  profile_shop_sections_empty: 'No sections.',
} as Messages;

const OTHER = { items: [], totalObjects: 3 };

function renderSections(page: ShopSectionsPage, lineageSegments: string[] = ['Women', 'Outerwear']) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <FavoritesSections
        accountName="alice"
        objectType="product"
        initialSections={page}
        lineageSegments={lineageSegments}
        navName="Outerwear"
        navPath={['Women']}
        shopFilters={{ tags: [], rating: null }}
      />
    </I18nProvider>,
  );
}

describe('FavoritesSections', () => {
  it('closes the last page with the Other section linking to the Other category', () => {
    renderSections({
      sections: [{ categoryName: 'Active & Performance', items: [], totalObjects: 3 }],
      cursor: null,
      hasMore: false,
      other: OTHER,
    });

    expect(screen.getAllByTestId('section')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Other' })).toHaveAttribute(
      'href',
      '/@alice/favorites/product/Women/Outerwear?other=1',
    );
  });

  it('links the root Other (uncategorized objects included) to the type root', () => {
    renderSections(
      {
        sections: [{ categoryName: 'Desserts', items: [], totalObjects: 5 }],
        cursor: null,
        hasMore: false,
        other: OTHER,
      },
      [],
    );

    expect(screen.getByRole('link', { name: 'Other' })).toHaveAttribute(
      'href',
      '/@alice/favorites/product?other=1',
    );
  });

  it('waits for the last page before showing Other', () => {
    renderSections({
      sections: [{ categoryName: 'Active & Performance', items: [], totalObjects: 3 }],
      cursor: 'Active & Performance',
      hasMore: true,
      other: OTHER,
    });

    expect(screen.queryByRole('link', { name: 'Other' })).not.toBeInTheDocument();
  });
});
