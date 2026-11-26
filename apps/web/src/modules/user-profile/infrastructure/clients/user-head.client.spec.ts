jest.mock('server-only', () => ({}));

const queryApiFetchOutcome = jest.fn();
jest.mock('./query-api.client', () => ({
  queryApiFetchOutcome: (...args: unknown[]) => queryApiFetchOutcome(...args),
}));

import { fetchUserHead } from './user-head.client';

const HEAD = {
  name: 'alice',
  displayName: 'Alice',
  bio: '',
  avatarUrl: null,
  coverImageUrl: null,
  followerCount: 1,
  followingCount: 2,
  postingCount: 3,
  reputation: 60,
  wobjectsWeight: 0,
};

describe('fetchUserHead', () => {
  beforeEach(() => queryApiFetchOutcome.mockReset());

  it('requests the head without viewer or locale and tags it', async () => {
    queryApiFetchOutcome.mockResolvedValue({ ok: true, data: HEAD });

    const outcome = await fetchUserHead('alice');

    expect(queryApiFetchOutcome).toHaveBeenCalledWith('/query/v1/users/alice/head', {
      cacheTags: ['query-api:user:alice:head'],
    });
    expect(outcome).toEqual({
      kind: 'found',
      view: { ...HEAD, is_following: false, viewer_bell: false },
    });
  });

  it('reports a definite 404 as missing', async () => {
    queryApiFetchOutcome.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchUserHead('ghost')).resolves.toEqual({ kind: 'missing' });
  });

  it.each([
    { ok: false, status: 503 },
    { ok: false, status: 'network' },
    { ok: true, data: { name: 'alice' } },
  ])('reports %o as unavailable, never as missing', async (result) => {
    queryApiFetchOutcome.mockResolvedValue(result);
    await expect(fetchUserHead('alice')).resolves.toEqual({ kind: 'unavailable' });
  });
});
