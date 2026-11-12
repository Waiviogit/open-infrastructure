import type { CommentEditTarget } from '../domain/comment-edit-target';

import { buildCommentEditOp } from './build-comment-edit-op';

const APP = 'opden/2.0.0';

function comment(
  overrides: Partial<CommentEditTarget> = {},
): CommentEditTarget {
  return {
    author: 'alice',
    permlink: 're-bob-root-post-20240101t000000000z',
    parentAuthor: 'bob',
    parentPermlink: 'root-post',
    title: '',
    body: 'Old text',
    jsonMetadata: JSON.stringify({
      app: 'opden/1.0.0',
      format: 'markdown',
      tags: ['hive', 'food'],
      links: ['https://example.com'],
      community: 'opden',
    }),
    ...overrides,
  };
}

function thread(overrides: Partial<CommentEditTarget> = {}): CommentEditTarget {
  return comment({
    permlink: 're-leothreads-abc',
    parentAuthor: 'leothreads',
    parentPermlink: 're-leothreads-container',
    body: 'Fresh batch today\n\n#fire-rock',
    ...overrides,
  });
}

describe('buildCommentEditOp', () => {
  it('keeps author, permlink and parent, and sends the edited body', () => {
    const op = buildCommentEditOp({
      target: comment(),
      body: 'New **text**',
      app: APP,
    });

    expect(op).toMatchObject({
      type: 'comment',
      author: 'alice',
      permlink: 're-bob-root-post-20240101t000000000z',
      parent_author: 'bob',
      parent_permlink: 'root-post',
      title: '',
      body: 'New **text**',
    });
  });

  it('keeps a title the published comment has', () => {
    const op = buildCommentEditOp({
      target: comment({ title: 'RE: Root post' }),
      body: 'New',
      app: APP,
    });

    expect(op.title).toBe('RE: Root post');
  });

  it('merges json_metadata: tags, links and foreign keys stay, app and format are this client', () => {
    const op = buildCommentEditOp({ target: comment(), body: 'New', app: APP });

    expect(JSON.parse(op.json_metadata)).toEqual({
      app: APP,
      format: 'markdown',
      tags: ['hive', 'food'],
      links: ['https://example.com'],
      community: 'opden',
    });
  });

  it('starts from an empty record when the published json_metadata is invalid', () => {
    const op = buildCommentEditOp({
      target: comment({ jsonMetadata: '{not json' }),
      body: 'New',
      app: APP,
    });

    expect(JSON.parse(op.json_metadata)).toEqual({
      app: APP,
      format: 'markdown',
    });
  });

  it('keeps a single thread anchor when the edited body still has it', () => {
    const op = buildCommentEditOp({
      target: thread(),
      body: 'Fresh batch, edited\n\n#fire-rock',
      app: APP,
    });

    expect(op.body).toBe('Fresh batch, edited\n\n#fire-rock');
    expect(op.body.match(/#fire-rock/g)).toHaveLength(1);
  });

  it('restores the thread anchor when the edit removed it', () => {
    const op = buildCommentEditOp({
      target: thread(),
      body: 'Only new text',
      app: APP,
    });

    expect(op.body).toBe('Only new text\n\n#fire-rock');
  });

  it('restores a /object/ path anchor for ids with a dot', () => {
    const op = buildCommentEditOp({
      target: thread({ body: 'Hello\n\n/object/my_object.name' }),
      body: 'Hello again',
      app: APP,
    });

    expect(op.body).toBe('Hello again\n\n/object/my_object.name');
  });

  it('does not add an anchor to a regular comment ending with a hashtag', () => {
    const op = buildCommentEditOp({
      target: comment({ body: 'Nice\n\n#travel' }),
      body: 'Nice, edited',
      app: APP,
    });

    expect(op.body).toBe('Nice, edited');
  });
});
