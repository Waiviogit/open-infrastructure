import { DEFAULT_GOVERNANCE_SNAPSHOT } from '@opden-data-layer/objects-domain';
import type { Thread } from '@opden-data-layer/odl-db-types';

import type { ProjectedObject } from '../object-projection/projected-object.types';
import { encodeFeedCursor } from './feed-cursor';
import type { FeedStoryItemDto } from './feed-story-dtos';
import { GetFollowedObjectsThreadsFeedEndpoint } from './get-followed-objects-threads-feed.endpoint';
import * as projectFeedObjects from './project-feed-objects';
import * as threadFeedHydrator from './thread-feed-hydrator';

jest.mock('./thread-feed-hydrator', () => ({
  hydrateThreadFeedPage: jest.fn(),
}));
jest.mock('./project-feed-objects', () => ({
  projectFeedObjectsById: jest.fn(),
}));

const hydrateMock = threadFeedHydrator.hydrateThreadFeedPage as jest.MockedFunction<
  typeof threadFeedHydrator.hydrateThreadFeedPage
>;
const projectMock = projectFeedObjects.projectFeedObjectsById as jest.MockedFunction<
  typeof projectFeedObjects.projectFeedObjectsById
>;

function threadRow(author: string, permlink: string, hashtags: string[]): Thread {
  return {
    author,
    permlink,
    hashtags,
    created_unix: 100,
    deleted: false,
  } as unknown as Thread;
}

function feedItem(id: string): FeedStoryItemDto {
  return { id, objects: [] } as unknown as FeedStoryItemDto;
}

function projected(objectId: string): ProjectedObject {
  return { object_id: objectId } as ProjectedObject;
}

describe('GetFollowedObjectsThreadsFeedEndpoint', () => {
  const threadsRepo = { findFollowedObjectsThreadsFeed: jest.fn() };
  const accounts = { findByName: jest.fn() };
  const userAccountMutesRepo = { listMutedForMuters: jest.fn() };
  const userObjectFollowsRepo = { findFollowedActiveObjectIdsAmong: jest.fn() };
  const governanceResolver = { resolveMergedForObjectView: jest.fn() };

  const endpoint = new GetFollowedObjectsThreadsFeedEndpoint(
    threadsRepo as never,
    accounts as never,
    userAccountMutesRepo as never,
    userObjectFollowsRepo as never,
    governanceResolver as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.findByName.mockResolvedValue({ name: 'alice' });
    userAccountMutesRepo.listMutedForMuters.mockResolvedValue(['spammer']);
    threadsRepo.findFollowedObjectsThreadsFeed.mockResolvedValue([]);
    userObjectFollowsRepo.findFollowedActiveObjectIdsAmong.mockResolvedValue([]);
    governanceResolver.resolveMergedForObjectView.mockResolvedValue(DEFAULT_GOVERNANCE_SNAPSHOT);
    hydrateMock.mockResolvedValue({ items: [], cursor: null, hasMore: false });
    projectMock.mockResolvedValue(new Map());
  });

  it('returns null when the account does not exist', async () => {
    accounts.findByName.mockResolvedValue(undefined);

    const result = await endpoint.execute('ghost', { limit: 20 }, 'en-US');

    expect(result).toBeNull();
    expect(threadsRepo.findFollowedObjectsThreadsFeed).not.toHaveBeenCalled();
  });

  it('returns an empty page for a malformed cursor', async () => {
    const result = await endpoint.execute('alice', { limit: 20, cursor: '%%%' }, 'en-US');

    expect(result).toEqual({ items: [], cursor: null, hasMore: false });
    expect(threadsRepo.findFollowedObjectsThreadsFeed).not.toHaveBeenCalled();
  });

  it('reads follows of the profile and applies viewer mutes and cursor', async () => {
    const cursor = encodeFeedCursor({ feedAt: 50, author: 'bob', permlink: 'p1' });

    await endpoint.execute('alice', { limit: 10, cursor }, 'en-US', undefined, 'carol');

    expect(userAccountMutesRepo.listMutedForMuters).toHaveBeenCalledWith(['carol']);
    expect(threadsRepo.findFollowedObjectsThreadsFeed).toHaveBeenCalledWith(
      'alice',
      ['spammer'],
      { feedAt: 50, author: 'bob', permlink: 'p1' },
      11,
    );
  });

  it('skips mute lookup for guests', async () => {
    await endpoint.execute('alice', { limit: 10 }, 'en-US');

    expect(userAccountMutesRepo.listMutedForMuters).not.toHaveBeenCalled();
    expect(threadsRepo.findFollowedObjectsThreadsFeed).toHaveBeenCalledWith('alice', [], null, 11);
  });

  it('attaches only followed objects tagged in each thread', async () => {
    threadsRepo.findFollowedObjectsThreadsFeed.mockResolvedValue([
      threadRow('bob', 't1', ['obj-a', 'random']),
      threadRow('dan', 't2', ['obj-b']),
    ]);
    hydrateMock.mockResolvedValue({
      items: [feedItem('bob/t1'), feedItem('dan/t2')],
      cursor: 'next',
      hasMore: true,
    });
    userObjectFollowsRepo.findFollowedActiveObjectIdsAmong.mockResolvedValue(['obj-a', 'obj-b']);
    projectMock.mockResolvedValue(
      new Map([
        ['obj-a', projected('obj-a')],
        ['obj-b', projected('obj-b')],
      ]),
    );

    const result = await endpoint.execute('alice', { limit: 2 }, 'en-US');

    expect(userObjectFollowsRepo.findFollowedActiveObjectIdsAmong).toHaveBeenCalledWith('alice', [
      'obj-a',
      'random',
      'obj-b',
    ]);
    expect(result?.items.map((item) => item.objects.map((o) => o.object_id))).toEqual([
      ['obj-a'],
      ['obj-b'],
    ]);
    expect(result?.cursor).toBe('next');
    expect(result?.hasMore).toBe(true);
  });
});
