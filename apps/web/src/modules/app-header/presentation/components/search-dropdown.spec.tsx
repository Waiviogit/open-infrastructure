/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type {
  SearchCountsResponse,
  SearchResponse,
} from '../../domain/search-response.schema';
import { SearchDropdown, type SearchDropdownProps } from './search-dropdown';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string;
    prefetch?: boolean | 'auto' | null;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} data-prefetch={String(prefetch ?? 'auto')} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/shared/presentation', () => ({
  UserAvatar: () => <span>avatar</span>,
  StatHoverTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const RESULTS: SearchResponse = {
  objects: [
    {
      object_id: 'obj-1',
      object_type: 'restaurant',
      name: 'Greek Taverna',
      image_url: null,
      parent_name: null,
    },
  ],
  users: [
    {
      name: 'alice',
      profile_image: null,
      reputation: 50,
      wobjects_weight: 1,
      followers_count: 2,
      is_following: false,
    },
  ],
};

const MESSAGES: SearchDropdownProps['messages'] = {
  sectionObjects: 'Objects',
  sectionUsers: 'Users',
  empty: 'No results',
  loading: 'Searching…',
  tabUsers: 'Users',
  following: 'Following',
  discoverChipsAria: 'Discover filters',
  userExpertiseTooltip: 'Expertise',
  userFollowersTooltip: 'Followers',
};

function renderDropdown(counts: SearchCountsResponse, onClose: () => void = jest.fn()) {
  render(
    <SearchDropdown
      results={RESULTS}
      resultsLoading={false}
      counts={counts}
      countsLoading={false}
      activeIndex={-1}
      flatList={[]}
      onHighlightIndex={jest.fn()}
      listId="search"
      searchQuery="gre"
      messages={MESSAGES}
      onClose={onClose}
    />,
  );
  return screen.getByRole('navigation', { name: 'Discover filters' });
}

describe('SearchDropdown object rows', () => {
  it('renders an object result as an option link to the object page', () => {
    const onClose = jest.fn();
    renderDropdown({ type_counts: { restaurant: 1 }, counts_capped: false, total_users: 1 }, onClose);

    const row = screen.getByRole('option', { name: /Greek Taverna/ });
    expect(row.tagName).toBe('A');
    expect(row).toHaveAttribute('href', '/object/obj-1');

    fireEvent.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a user result as an option link to the profile', () => {
    const onClose = jest.fn();
    renderDropdown({ type_counts: { restaurant: 1 }, counts_capped: false, total_users: 1 }, onClose);

    const row = screen.getByRole('option', { name: /alice/ });
    expect(row.tagName).toBe('A');
    expect(row).toHaveAttribute('href', '/@alice');

    fireEvent.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prefetches the object head only for the row the user points at', () => {
    const flatList = [{ kind: 'object' as const, item: RESULTS.objects[0] }];
    const { rerender } = render(
      <SearchDropdown
        results={RESULTS}
        resultsLoading={false}
        counts={null}
        countsLoading={false}
        activeIndex={0}
        flatList={flatList}
        onHighlightIndex={jest.fn()}
        listId="search"
        searchQuery="gre"
        messages={MESSAGES}
        onClose={jest.fn()}
      />,
    );
    const row = () => screen.getByRole('option', { name: /Greek Taverna/ });
    expect(row()).toHaveAttribute('data-prefetch', 'auto');

    rerender(
      <SearchDropdown
        results={RESULTS}
        resultsLoading={false}
        counts={null}
        countsLoading={false}
        activeIndex={0}
        intentIndex={0}
        flatList={flatList}
        onHighlightIndex={jest.fn()}
        listId="search"
        searchQuery="gre"
        messages={MESSAGES}
        onClose={jest.fn()}
      />,
    );
    expect(row()).toHaveAttribute('data-prefetch', 'true');
  });
});

describe('SearchDropdown chip counts', () => {
  it('renders N+ on object type chips only when counts are capped', () => {
    const chips = renderDropdown({
      type_counts: { restaurant: 100_000, product: 42 },
      counts_capped: true,
      total_users: 7,
    });

    expect(chips).toHaveTextContent('Restaurant (100000+)');
    expect(chips).toHaveTextContent('Product (42+)');
    expect(chips).toHaveTextContent('Users (7)');
    expect(chips).not.toHaveTextContent('(7+)');
  });

  it('renders exact counts when counts are not capped', () => {
    const chips = renderDropdown({
      type_counts: { restaurant: 3 },
      counts_capped: false,
      total_users: 7,
    });

    expect(chips).toHaveTextContent('Restaurant (3)');
    expect(chips).toHaveTextContent('Users (7)');
    expect(chips).not.toHaveTextContent('+');
  });
});
