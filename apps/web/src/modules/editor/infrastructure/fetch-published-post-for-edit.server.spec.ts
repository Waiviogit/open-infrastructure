/** @jest-environment node */

jest.mock('server-only', () => ({}));

const mockFetchSinglePost = jest.fn();

jest.mock('@/modules/feed/infrastructure/clients/single-post.client', () => ({
  fetchSinglePost: (...args: unknown[]) => mockFetchSinglePost(...args),
}));

import { fetchPublishedPostForEdit } from './fetch-published-post-for-edit.server';

const rootPost = {
  author: 'alice',
  permlink: 'my-post',
  parentAuthor: '',
  parentPermlink: 'food',
  title: 'My post',
  body: 'Body',
  jsonMetadata: '{}',
};

describe('fetchPublishedPostForEdit', () => {
  beforeEach(() => {
    mockFetchSinglePost.mockReset();
  });

  it("returns the author's root post", async () => {
    mockFetchSinglePost.mockResolvedValue(rootPost);

    const result = await fetchPublishedPostForEdit('alice', 'my-post');

    expect(result).toEqual({ ok: true, value: rootPost });
  });

  it('refuses a comment: `/editor` edits root posts only', async () => {
    mockFetchSinglePost.mockResolvedValue({
      ...rootPost,
      permlink: 're-bob-root',
      parentAuthor: 'bob',
      parentPermlink: 'root',
      title: '',
    });

    const result = await fetchPublishedPostForEdit('alice', 're-bob-root');

    expect(result).toEqual({ ok: false, error: 'not_a_post' });
  });

  it('refuses a Leo thread', async () => {
    mockFetchSinglePost.mockResolvedValue({
      ...rootPost,
      parentAuthor: 'leothreads',
      parentPermlink: 're-leothreads-container',
    });

    expect(await fetchPublishedPostForEdit('alice', 'my-post')).toEqual({
      ok: false,
      error: 'not_a_post',
    });
  });

  it('is not found for another author or a missing post', async () => {
    mockFetchSinglePost.mockResolvedValueOnce({ ...rootPost, author: 'bob' });
    expect(await fetchPublishedPostForEdit('alice', 'my-post')).toEqual({
      ok: false,
      error: 'not_found',
    });

    mockFetchSinglePost.mockResolvedValueOnce(null);
    expect(await fetchPublishedPostForEdit('alice', 'my-post')).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});
