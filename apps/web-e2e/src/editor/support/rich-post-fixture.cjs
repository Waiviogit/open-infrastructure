'use strict';
/**
 * Single post served by the editor e2e query-api stub, rendered by the real post
 * page (`/@author/permlink`). Its body covers every block and text format the post
 * editor supports, so the copy → paste spec checks them all in one pass.
 */
const RICH_POST_AUTHOR = 'e2e-author';
const RICH_POST_PERMLINK = 'e2e-rich-post';
const RICH_POST_IMAGE_URL = 'https://example.com/e2e-rich-post.jpg';
const RICH_POST_VIDEO_URL = 'https://www.youtube.com/watch?v=vJgM9oF7siA';

const RICH_POST_BODY = [
  '## Section heading',
  '',
  'Plain start with **bold words**, *italic words*, ~~struck words~~ and a [docs link](https://example.com/docs).',
  '',
  `![e2e photo](${RICH_POST_IMAGE_URL})`,
  '',
  '- first bullet',
  '- second bullet',
  '',
  '1. first step',
  '2. second step',
  '',
  '> quoted line',
  '',
  'Use `inline code` here.',
  '',
  '```',
  'const answer = 42;',
  '```',
  '',
  '| Name | Value |',
  '| --- | --- |',
  '| alpha | 1 |',
  '',
  '---',
  '',
  RICH_POST_VIDEO_URL,
  '',
  'Closing paragraph.',
].join('\n');

const RICH_POST = {
  id: 'e2e-rich-post-id',
  author: RICH_POST_AUTHOR,
  permlink: RICH_POST_PERMLINK,
  title: 'E2E rich post',
  excerpt: 'Plain start with bold words',
  createdAt: '2026-01-01T00:00:00.000Z',
  feedAt: '2026-01-01T00:00:00.000Z',
  rebloggedBy: null,
  isNsfw: false,
  category: 'e2e',
  children: 0,
  pendingPayout: '0.000 HBD',
  totalPayout: '0.000 HBD',
  netRshares: '0',
  thumbnailUrl: null,
  videoThumbnailUrl: null,
  videoEmbedUrl: null,
  authorProfile: {
    name: RICH_POST_AUTHOR,
    displayName: null,
    avatarUrl: null,
    reputation: 25,
    wobjectsWeight: 0,
  },
  objects: [],
  votes: { totalCount: 0, previewVoters: [], voted: false },
  body: RICH_POST_BODY,
};

/** The post page lives under the author's profile layout, which 404s without a profile. */
const RICH_POST_AUTHOR_PROFILE = {
  name: RICH_POST_AUTHOR,
  displayName: 'E2E Author',
  bio: '',
  avatarUrl: null,
  coverImageUrl: null,
  followerCount: 0,
  followingCount: 0,
  postingCount: 1,
  reputation: 25,
  wobjectsWeight: 0,
  is_following: false,
  viewer_bell: false,
};

/** query-api path → JSON body served by the stub. */
const RICH_POST_ROUTES = {
  [`/query/v1/posts/${RICH_POST_AUTHOR}/${RICH_POST_PERMLINK}`]: RICH_POST,
  [`/query/v1/users/${RICH_POST_AUTHOR}/profile`]: RICH_POST_AUTHOR_PROFILE,
};

module.exports = { RICH_POST_ROUTES };
