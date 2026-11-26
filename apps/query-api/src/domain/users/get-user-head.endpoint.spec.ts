import type { AccountCurrent } from '@opden-data-layer/odl-db-types';

import type { AccountsCurrentRepository } from '../../repositories';
import { mapAccountToUserProfileView } from './account-mapper';
import { GetUserHeadEndpoint } from './get-user-head.endpoint';

function accountRow(overrides: Partial<AccountCurrent>): AccountCurrent {
  return {
    name: 'alice',
    alias: null,
    profile_image: null,
    json_metadata: null,
    posting_json_metadata: JSON.stringify({
      profile: {
        name: 'Alice',
        about: 'Coffee',
        profile_image: 'https://img/posting.png',
        cover_image: 'https://img/cover.jpg',
      },
    }),
    followers_count: 3,
    users_following_count: 4,
    post_count: 5,
    object_reputation: 61,
    wobjects_weight: 12.5,
    ...overrides,
  } as AccountCurrent;
}

function makeEndpoint(row: AccountCurrent | null) {
  const accounts = {
    findByName: jest.fn().mockResolvedValue(row),
  } as unknown as AccountsCurrentRepository;
  return { endpoint: new GetUserHeadEndpoint(accounts), accounts };
}

describe('GetUserHeadEndpoint', () => {
  it('returns null for an unknown account', async () => {
    const { endpoint } = makeEndpoint(null);
    await expect(endpoint.execute('ghost')).resolves.toBeNull();
  });

  it('maps the indexed row like the profile, without viewer fields', async () => {
    const row = accountRow({});
    const { endpoint, accounts } = makeEndpoint(row);

    const head = await endpoint.execute('alice');

    expect(accounts.findByName).toHaveBeenCalledWith('alice');
    expect(head).toEqual({
      name: 'alice',
      displayName: 'Alice',
      bio: 'Coffee',
      avatarUrl: 'https://img/posting.png',
      coverImageUrl: 'https://img/cover.jpg',
      followerCount: 3,
      followingCount: 4,
      postingCount: 5,
      reputation: 61,
      wobjectsWeight: 12.5,
    });
    const { is_following, viewer_bell, ...profileWithoutViewer } = mapAccountToUserProfileView(row, null);
    expect({ is_following, viewer_bell }).toEqual({ is_following: false, viewer_bell: false });
    expect(head).toEqual(profileWithoutViewer);
  });

  it('falls back to the profile_image column for the avatar', async () => {
    const { endpoint } = makeEndpoint(
      accountRow({ posting_json_metadata: null, profile_image: 'https://img/column.png' }),
    );

    const head = await endpoint.execute('alice');

    expect(head).toMatchObject({ displayName: 'alice', avatarUrl: 'https://img/column.png', coverImageUrl: null });
  });
});
