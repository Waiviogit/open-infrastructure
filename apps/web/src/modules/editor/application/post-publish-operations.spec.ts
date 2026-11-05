import {
  buildPostPublishOperations,
  editorJsonMetadataFromPublishedPost,
  mergeEditedPostJsonMetadata,
} from './post-publish-operations';

const CONTENT = {
  author: 'alice',
  permlink: 'my-post',
  parentPermlink: 'waivio',
  title: 'My post',
  body: 'Hello',
  jsonMetadata: '{"tags":["waivio"]}',
};

describe('buildPostPublishOperations', () => {
  it('adds a full-weight self-upvote from the author to a new post', () => {
    const ops = buildPostPublishOperations({
      ...CONTENT,
      mode: 'create',
      rewardMode: 'fifty_fifty',
      beneficiaries: [],
      selfUpvote: true,
    });

    expect(ops.map((op) => op.type)).toEqual(['comment', 'comment_options', 'vote']);
    expect(ops[2]).toEqual({
      type: 'vote',
      voter: 'alice',
      author: 'alice',
      permlink: 'my-post',
      weight: 10000,
    });
  });

  it('does not vote when self-upvote is off', () => {
    const ops = buildPostPublishOperations({
      ...CONTENT,
      mode: 'create',
      rewardMode: 'fifty_fifty',
      beneficiaries: [],
      selfUpvote: false,
    });

    expect(ops.map((op) => op.type)).toEqual(['comment', 'comment_options']);
  });

  it('broadcasts only the comment with the original permlink when editing', () => {
    const ops = buildPostPublishOperations({ ...CONTENT, mode: 'edit', parentPermlink: 'food' });

    expect(ops).toEqual([
      {
        type: 'comment',
        parent_author: '',
        parent_permlink: 'food',
        author: 'alice',
        permlink: 'my-post',
        title: 'My post',
        body: 'Hello',
        json_metadata: '{"tags":["waivio"]}',
      },
    ]);
  });
});

describe('mergeEditedPostJsonMetadata', () => {
  it('keeps keys the editor does not own and replaces the ones it does', () => {
    const merged = mergeEditedPostJsonMetadata('{"app":"x","foo":1,"tags":["a"]}', {
      tags: ['b'],
      app: 'waivio/2',
    });

    expect(merged).toEqual({ app: 'waivio/2', foo: 1, tags: ['b'] });
  });

  it('treats malformed published metadata as empty', () => {
    expect(mergeEditedPostJsonMetadata('{not json', { tags: ['b'] })).toEqual({ tags: ['b'] });
  });
});

describe('editorJsonMetadataFromPublishedPost', () => {
  it('turns legacy wobj.wobjects into linked objects with their percents', () => {
    const meta = editorJsonMetadataFromPublishedPost(
      JSON.stringify({
        wobj: { wobjects: [{ author_permlink: 'abc-cafe', percent: 60 }, { author_permlink: 'xyz', percent: 40 }] },
        community: 'waivio',
      }),
    );

    expect(meta.objects).toEqual([
      { object_id: 'abc-cafe', percent: 60 },
      { object_id: 'xyz', percent: 40 },
    ]);
    expect(meta.community).toBe('waivio');
    expect(meta).not.toHaveProperty('wobj');
  });

  it('keeps existing objects untouched', () => {
    const meta = editorJsonMetadataFromPublishedPost({
      objects: [{ object_id: 'a', percent: 100 }],
      wobj: { wobjects: [{ author_permlink: 'b', percent: 100 }] },
    });

    expect(meta.objects).toEqual([{ object_id: 'a', percent: 100 }]);
  });
});
