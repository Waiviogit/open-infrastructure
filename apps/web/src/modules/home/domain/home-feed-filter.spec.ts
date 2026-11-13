import {
  buildHomeFeedHref,
  homeFeedFilterKey,
  parseHomeFeedFilter,
  resolveHomeFeedFilter,
} from './home-feed-filter';

describe('home feed filter URL', () => {
  it('reads one filter: object over author over sort', () => {
    expect(parseHomeFeedFilter(new URLSearchParams('filter=hot'))).toEqual({ kind: 'hot' });
    expect(parseHomeFeedFilter(new URLSearchParams('filter=hot&author=Alice'))).toEqual({
      kind: 'author',
      account: 'alice',
    });
    expect(parseHomeFeedFilter({ author: 'alice', object: 'obj-1' })).toEqual({
      kind: 'object',
      objectId: 'obj-1',
    });
  });

  it('ignores invalid values', () => {
    expect(parseHomeFeedFilter(new URLSearchParams('filter=best'))).toBeNull();
    expect(parseHomeFeedFilter(new URLSearchParams('author=a'))).toBeNull();
    expect(parseHomeFeedFilter(new URLSearchParams('object=%20'))).toBeNull();
    expect(parseHomeFeedFilter({})).toBeNull();
  });

  it('builds tab hrefs that carry exactly one filter param', () => {
    expect(buildHomeFeedHref('/', null)).toBe('/');
    expect(buildHomeFeedHref('/feed/threads', { kind: 'trending' })).toBe('/feed/threads?filter=trending');
    expect(buildHomeFeedHref('/feed/updates', { kind: 'author', account: 'alice' })).toBe(
      '/feed/updates?author=alice',
    );
    expect(buildHomeFeedHref('/', { kind: 'object', objectId: 'a b' })).toBe('/?object=a+b');
  });

  it('defaults to my feed when signed in, else the first site-wide sort of the tab', () => {
    expect(resolveHomeFeedFilter('posts', null, true).effective).toEqual({ kind: 'my' });
    expect(resolveHomeFeedFilter('posts', null, false).effective).toEqual({ kind: 'trending' });
    expect(resolveHomeFeedFilter('activity', null, false).effective).toEqual({ kind: 'new' });
  });

  it('falls back to new for a sort the tab does not support and keeps the request', () => {
    const resolved = resolveHomeFeedFilter('activity', { kind: 'hot' }, true);
    expect(resolved).toEqual({
      effective: { kind: 'new' },
      requested: { kind: 'hot' },
      notice: 'sort_unavailable',
    });
    expect(resolveHomeFeedFilter('updates', { kind: 'trending' }, true).notice).toBeNull();
    expect(resolveHomeFeedFilter('updates', { kind: 'hot' }, true).effective).toEqual({ kind: 'new' });
  });

  it('asks guests to sign in for my feed', () => {
    expect(resolveHomeFeedFilter('posts', { kind: 'my' }, false)).toEqual({
      effective: { kind: 'trending' },
      requested: { kind: 'my' },
      notice: 'sign_in_required',
    });
  });

  it('keys filters for list identity', () => {
    expect(homeFeedFilterKey(null)).toBe('default');
    expect(homeFeedFilterKey({ kind: 'author', account: 'alice' })).toBe('author:alice');
  });
});
