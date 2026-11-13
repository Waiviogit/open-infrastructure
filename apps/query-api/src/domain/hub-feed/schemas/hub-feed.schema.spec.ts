import {
  hubActivityFeedBodySchema,
  hubPostsFeedBodySchema,
  hubUpdatesFeedBodySchema,
} from './hub-feed.schema';

describe('hub feed body schemas', () => {
  it('defaults to the site-wide new feed', () => {
    expect(hubPostsFeedBodySchema.parse(undefined)).toEqual({
      limit: 20,
      currency: 'USD',
      filter: { kind: 'new' },
    });
  });

  it('normalizes the author filter and rejects invalid names', () => {
    const body = hubPostsFeedBodySchema.parse({ filter: { kind: 'author', account: ' @Alice ' } });
    expect(body.filter).toEqual({ kind: 'author', account: 'alice' });
    expect(
      hubPostsFeedBodySchema.safeParse({ filter: { kind: 'author', account: 'a' } }).success,
    ).toBe(false);
  });

  it('rejects sorts a tab does not support', () => {
    expect(hubActivityFeedBodySchema.safeParse({ filter: { kind: 'trending' } }).success).toBe(false);
    expect(hubActivityFeedBodySchema.safeParse({ filter: { kind: 'hot' } }).success).toBe(false);
    expect(hubUpdatesFeedBodySchema.safeParse({ filter: { kind: 'hot' } }).success).toBe(false);
    expect(hubUpdatesFeedBodySchema.safeParse({ filter: { kind: 'trending' } }).success).toBe(true);
  });

  it('caps the page size', () => {
    expect(hubPostsFeedBodySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
});
