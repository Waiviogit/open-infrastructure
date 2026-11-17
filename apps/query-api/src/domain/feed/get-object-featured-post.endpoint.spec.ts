import type { SinglePostViewDto } from './feed-story-dtos';
import { GetObjectFeaturedPostEndpoint } from './get-object-featured-post.endpoint';
import { GetObjectPostsFeedEndpoint } from './get-object-posts-feed.endpoint';
import { GetPostByKeyEndpoint } from './get-post-by-key.endpoint';

describe('GetObjectFeaturedPostEndpoint', () => {
  let feed: jest.Mocked<Pick<GetObjectPostsFeedEndpoint, 'findFirstPost'>>;
  let getPostByKey: jest.Mocked<Pick<GetPostByKeyEndpoint, 'execute'>>;
  let endpoint: GetObjectFeaturedPostEndpoint;

  const params = {
    objectId: 'tom-yum',
    locale: 'en-US',
    viewerAccount: 'viewer',
    currency: 'USD' as const,
    countryCode: null,
  };
  const post = { author: 'foodster', permlink: 'tom-yum' } as SinglePostViewDto;

  beforeEach(() => {
    feed = { findFirstPost: jest.fn() };
    getPostByKey = { execute: jest.fn().mockResolvedValue(post) };
    endpoint = new GetObjectFeaturedPostEndpoint(
      feed as unknown as GetObjectPostsFeedEndpoint,
      getPostByKey as unknown as GetPostByKeyEndpoint,
    );
  });

  it('returns null for an unknown object', async () => {
    feed.findFirstPost.mockResolvedValue(null);

    await expect(endpoint.execute(params)).resolves.toBeNull();
  });

  it('returns no post when the object has no posts', async () => {
    feed.findFirstPost.mockResolvedValue({ first: null });

    await expect(endpoint.execute(params)).resolves.toEqual({ post: null, source: null });
    expect(getPostByKey.execute).not.toHaveBeenCalled();
  });

  it('loads the first feed post in full and reports its source', async () => {
    feed.findFirstPost.mockResolvedValue({
      first: { author: 'foodster', permlink: 'tom-yum', source: 'latest' },
    });

    await expect(endpoint.execute(params)).resolves.toEqual({ post, source: 'latest' });
    expect(feed.findFirstPost).toHaveBeenCalledWith('tom-yum', 'en-US', undefined);
    expect(getPostByKey.execute).toHaveBeenCalledWith(
      'foodster',
      'tom-yum',
      'en-US',
      undefined,
      'viewer',
      'USD',
      null,
    );
  });

  it('returns no post when the featured post cannot be loaded', async () => {
    feed.findFirstPost.mockResolvedValue({
      first: { author: 'foodster', permlink: 'gone', source: 'pinned' },
    });
    getPostByKey.execute.mockResolvedValue(null);

    await expect(endpoint.execute(params)).resolves.toEqual({ post: null, source: null });
  });
});
