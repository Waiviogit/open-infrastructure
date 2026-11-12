import { mapSinglePostToCommentEditTarget } from './comment-edit-target-from-api.mapper';

const singlePost = {
  id: 'alice/re-bob-root',
  author: 'alice',
  permlink: 're-bob-root',
  parentAuthor: 'bob',
  parentPermlink: 'root',
  title: '',
  excerpt: 'Hi',
  body: 'Hi **there**',
  jsonMetadata: '{"tags":["hive"]}',
};

describe('mapSinglePostToCommentEditTarget', () => {
  it("returns the edit target of the viewer's own comment", () => {
    expect(mapSinglePostToCommentEditTarget(singlePost, 'Alice')).toEqual({
      ok: true,
      value: {
        author: 'alice',
        permlink: 're-bob-root',
        parentAuthor: 'bob',
        parentPermlink: 'root',
        title: '',
        body: 'Hi **there**',
        jsonMetadata: '{"tags":["hive"]}',
      },
    });
  });

  it('refuses a root post', () => {
    expect(
      mapSinglePostToCommentEditTarget(
        { ...singlePost, parentAuthor: '' },
        'alice',
      ),
    ).toEqual({ ok: false, error: 'not_a_reply' });
  });

  it("refuses someone else's comment", () => {
    expect(mapSinglePostToCommentEditTarget(singlePost, 'mallory')).toEqual({
      ok: false,
      error: 'not_author',
    });
  });

  it('treats a malformed body as not found', () => {
    expect(
      mapSinglePostToCommentEditTarget({ author: 'alice' }, 'alice'),
    ).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});
