/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import type {
  SearchCountsResponse,
  SearchResponse,
} from '../../domain/search-response.schema';
import { SearchDropdown, type SearchDropdownProps } from './search-dropdown';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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

function renderDropdown(counts: SearchCountsResponse) {
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
      onClose={jest.fn()}
    />,
  );
  return screen.getByRole('navigation', { name: 'Discover filters' });
}

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
