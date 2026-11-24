/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { buildDiscoverHref } from '../../domain/discover-url';
import { fetchDiscoverSections } from '../../infrastructure/discover.client';
import {
  clearDiscoverFeedCacheForTests,
  discoverSectionsCacheKey,
  writeDiscoverSectionsCache,
} from '../../infrastructure/discover-feed-cache';
import { DiscoverSections } from './discover-sections';

jest.mock('../../infrastructure/discover.client', () => ({
  fetchDiscoverSections: jest.fn(),
}));

let mockRestorePending = false;
jest.mock('@/shared/presentation/navigation/scroll-memory', () => ({
  isScrollRestorePending: () => mockRestorePending,
}));

jest.mock('@/shared/presentation', () => ({
  useInfiniteScroll: () => ({ sentinelRef: { current: null } }),
  OptimisticNavLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/shared/presentation/layout', () => ({
  FeedColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerRegion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/modules/feed/presentation', () => ({
  CategorySectionCard: ({
    title,
    href,
    totalObjects,
    items,
  }: {
    title: string;
    href: string;
    totalObjects: number;
    items: unknown[];
  }) => (
    <section data-testid="section">
      <a href={href}>{title}</a> {totalObjects}/{items.length}
    </section>
  ),
}));

const fetchMock = jest.mocked(fetchDiscoverSections);

const messages = {
  discover_no_results: 'No results found.',
  discover_loading: 'Loading…',
  profile_shop_load_more_sections: 'Load more sections',
} as Messages;

const PAGE = {
  sections: [
    { categoryName: 'Audio', totalObjects: 20, items: [{ object_id: 'a1' }] },
    { categoryName: 'Video', totalObjects: 12, items: [] },
  ],
  cursor: 'Video',
  hasMore: true,
};

const hrefFor = (lineage: readonly string[]) =>
  buildDiscoverHref({ type: 'product', categoryPath: lineage, sort: 'newest' });

function renderSections() {
  return render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <DiscoverSections objectType="product" categoryPath={['Electronics']} hrefFor={hrefFor} />
    </I18nProvider>,
  );
}

describe('DiscoverSections', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearDiscoverFeedCacheForTests();
    mockRestorePending = false;
  });

  it('loads the first page of blocks for the lineage and links each block to its category', async () => {
    fetchMock.mockResolvedValue(PAGE as never);

    renderSections();

    await waitFor(() => expect(screen.getAllByTestId('section')).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith(
      'product',
      expect.objectContaining({ categoryPath: ['Electronics'], cursor: null }),
    );
    expect(screen.getByRole('link', { name: 'Audio' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Electronics&cat=Audio&sort=newest',
    );
  });

  it('seeds the blocks from the session cache while a scroll restore is pending', () => {
    writeDiscoverSectionsCache(discoverSectionsCacheKey('product', ['Electronics']), PAGE as never);
    mockRestorePending = true;

    renderSections();

    expect(screen.getAllByTestId('section')).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows no results when the category has no blocks', async () => {
    fetchMock.mockResolvedValue({ sections: [], cursor: null, hasMore: false });

    renderSections();

    expect(await screen.findByText('No results found.')).toBeInTheDocument();
  });
});
