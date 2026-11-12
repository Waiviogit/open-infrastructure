import { isReplyFeedItem, viewerIsAuthor } from './feed-item-kind';

describe('isReplyFeedItem', () => {
  it('is a reply when the parent author is set', () => {
    expect(isReplyFeedItem('bob', 'posts')).toBe(true);
  });

  it('is a root post when the parent author is empty on the posts tab', () => {
    expect(isReplyFeedItem('', 'posts')).toBe(false);
    expect(isReplyFeedItem(undefined, undefined)).toBe(false);
  });

  it('treats comments and threads tab items as replies without a parent author', () => {
    expect(isReplyFeedItem(undefined, 'comments')).toBe(true);
    expect(isReplyFeedItem('', 'threads')).toBe(true);
  });
});

describe('viewerIsAuthor', () => {
  it('matches case-insensitively', () => {
    expect(viewerIsAuthor(' Alice ', 'alice')).toBe(true);
  });

  it('is false for a signed-out or different viewer', () => {
    expect(viewerIsAuthor(null, 'alice')).toBe(false);
    expect(viewerIsAuthor('', 'alice')).toBe(false);
    expect(viewerIsAuthor('bob', 'alice')).toBe(false);
  });
});
