import { GetHubPostsFeedEndpoint } from './get-hub-posts-feed.endpoint';
import {
  decodeHubFeedCursor,
  encodeHubFeedCursor,
  hubScoreCursorSchema,
  hubTimeCursorSchema,
} from './hub-feed-cursor';
import { HubFeedViewerRequiredError } from './hub-feed-viewer-required.error';
import { hubPostsFeedBodySchema } from './schemas/hub-feed.schema';

jest.mock('../feed/build-feed-story-items-from-post-page', () => ({
  buildFeedStoryItemsFromPostPage: jest.fn(async (_deps: unknown, rows: { permlink: string }[]) =>
    rows.map((r) => ({ id: r.permlink })),
  ),
}));

const row = (permlink: string, feedAt: number, score?: string) => ({
  author: 'alice',
  permlink,
  feed_at: feedAt,
  reblogged_by: null,
  ...(score ? { score } : {}),
});

function setup(muted: string[] = []) {
  const hubPostsRepo = {
    findNew: jest.fn().mockResolvedValue([row('p1', 300), row('p2', 200), row('p3', 100)]),
    findRanked: jest
      .fn()
      .mockResolvedValue([row('p1', 300, '900'), row('p2', 200, '800'), row('p3', 100, '7')]),
    findMy: jest.fn().mockResolvedValue([]),
    findByAuthor: jest.fn().mockResolvedValue([]),
    findByObject: jest.fn().mockResolvedValue([]),
  };
  const mutes = { listMutedForMuters: jest.fn().mockResolvedValue(muted) };
  const endpoint = new GetHubPostsFeedEndpoint(
    hubPostsRepo as never,
    {} as never,
    {} as never,
    mutes as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { endpoint, hubPostsRepo };
}

const body = (raw: Record<string, unknown>) => hubPostsFeedBodySchema.parse(raw);

describe('GetHubPostsFeedEndpoint', () => {
  it('routes each filter to its repository method with viewer mutes', async () => {
    const { endpoint, hubPostsRepo } = setup(['spam']);

    await endpoint.execute(body({ filter: { kind: 'my' } }), 'en-US', undefined, 'viewer');
    await endpoint.execute(
      body({ filter: { kind: 'author', account: 'bob' } }),
      'en-US',
      undefined,
      'viewer',
    );
    await endpoint.execute(
      body({ filter: { kind: 'object', object_id: 'obj' } }),
      'en-US',
      undefined,
      'viewer',
    );

    expect(hubPostsRepo.findMy).toHaveBeenCalledWith('viewer', ['spam'], null, 21);
    expect(hubPostsRepo.findByAuthor).toHaveBeenCalledWith('bob', null, 21);
    expect(hubPostsRepo.findByObject).toHaveBeenCalledWith('obj', ['spam'], null, 21);
  });

  it('requires a viewer for my feed', async () => {
    const { endpoint } = setup();
    await expect(
      endpoint.execute(body({ filter: { kind: 'my' } }), 'en-US'),
    ).rejects.toBeInstanceOf(HubFeedViewerRequiredError);
  });

  it('pages the new feed with a time cursor bound to the filter', async () => {
    const { endpoint } = setup();

    const page = await endpoint.execute(body({ limit: 2 }), 'en-US');

    expect(page.items).toEqual([{ id: 'p1' }, { id: 'p2' }]);
    expect(page.hasMore).toBe(true);
    expect(decodeHubFeedCursor(page.cursor ?? '', 'new', hubTimeCursorSchema)).toEqual({
      feedAt: 200,
      author: 'alice',
      permlink: 'p2',
    });
  });

  it('ranked pages pin the window start and continue from the score', async () => {
    const { endpoint, hubPostsRepo } = setup();

    const first = await endpoint.execute(body({ limit: 2, filter: { kind: 'hot' } }), 'en-US');
    const cursor = decodeHubFeedCursor(first.cursor ?? '', 'hot', hubScoreCursorSchema);
    expect(cursor).toMatchObject({ score: '800', author: 'alice', permlink: 'p2' });
    expect(hubPostsRepo.findRanked).toHaveBeenCalledWith('children', cursor?.windowStart, [], null, 3);

    await endpoint.execute(
      body({ limit: 2, filter: { kind: 'hot' }, cursor: first.cursor }),
      'en-US',
    );
    expect(hubPostsRepo.findRanked).toHaveBeenLastCalledWith(
      'children',
      cursor?.windowStart,
      [],
      cursor,
      3,
    );
  });

  it('answers a cursor of another filter with an empty page', async () => {
    const { endpoint, hubPostsRepo } = setup();
    const foreign = encodeHubFeedCursor('my', { feedAt: 1, author: 'a', permlink: 'p' });

    const page = await endpoint.execute(body({ cursor: foreign }), 'en-US');

    expect(page).toEqual({ items: [], cursor: null, hasMore: false });
    expect(hubPostsRepo.findNew).not.toHaveBeenCalled();
  });
});
