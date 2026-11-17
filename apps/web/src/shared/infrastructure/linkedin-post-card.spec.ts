import {
  fetchLinkedInPostCard,
  isLinkedInEmbedUrn,
  linkedInIframesToCardSlots,
  linkedInUrnFromEmbedSrc,
  parseLinkedInPostCard,
} from './linkedin-post-card';

const URN = 'urn:li:share:7523793420038053888';
const AVATAR =
  'https://media.licdn.com/dms/image/v2/C4E/profile-displayphoto-shrink_400_400/0/1?e=2147483647&amp;v=beta&amp;t=abc';
const IMAGE_1 =
  'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1?e=2147483647&amp;v=beta&amp;t=one';
const IMAGE_2 =
  'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/2?e=2147483647&amp;v=beta&amp;t=two';

/** Author lockup as the live embed page renders it (attributes trimmed). */
function lockup({
  avatar = AVATAR,
  href = 'https://it.linkedin.com/in/matteocollina?trk=public_post_embed_feed-actor-name',
} = {}) {
  return (
    '<div class="flex items-center" data-test-id="main-feed-activity-embed-card__entity-lockup">' +
    `<a href="https://it.linkedin.com/in/matteocollina?trk=public_post_embed_feed-actor-image"><div role="img" aria-label="View profile" class="inline-block\n rounded-[50%]" data-delayed-url="${avatar}"></div></a>` +
    '<div class="flex flex-col"><div class="text-color-text">' +
    `<a class="text-sm" href="${href}" data-tracking-control-name="public_post_embed_feed-actor-name">\n Matteo Collina\n</a></div>` +
    '<p class="!text-xs truncate"><!---->\n Platformatic Co-Founder &amp; CTO\n</p>' +
    '<span class="!text-xs"><time class="flex-none">1w</time></span></div></div>' +
    '<a href="https://www.linkedin.com/feed/" data-test-id="main-feed-activity-embed-card__linkedin-logo-image"><icon data-test-id="nav-logo"></icon></a>'
  );
}

const COMMENTARY =
  '<p class="whitespace-pre-wrap" dir="ltr" data-test-id="main-feed-activity-embed-card__commentary">' +
  'Joining <a class="link" href="https://www.linkedin.com/company/x">OpenJS &amp; friends</a>!<br>Second line&#39;s end &#x1F389;</p>';

const SOCIAL =
  '<div class="flex" data-test-id="main-feed-activity-embed-card__social-actions">' +
  '<a data-test-id="social-actions__reactions" data-num-reactions="154"><span data-test-id="social-actions__reaction-count">154</span></a>' +
  '<a data-test-id="social-actions__comments" data-num-comments="4">4 Comments</a></div>';

function embedHtml(body: string, author = lockup()): string {
  return `<html><body><article>${author}${body}${SOCIAL}</article></body></html>`;
}

function imageItem(url: string, alt: string): string {
  return (
    '<li data-test-id="feed-images-content__list-item">' +
    `<img class="lazy-load w-full" data-delayed-url="${url}" alt="${alt}"></li>`
  );
}

describe('parseLinkedInPostCard', () => {
  it('reads author, text and counts of a text post', () => {
    expect(parseLinkedInPostCard(embedHtml(COMMENTARY), URN)).toEqual({
      permalink: `https://www.linkedin.com/feed/update/${URN}`,
      activityHeader: null,
      author: {
        name: 'Matteo Collina',
        headline: 'Platformatic Co-Founder & CTO',
        profileUrl: 'https://it.linkedin.com/in/matteocollina',
        avatarUrl:
          'https://media.licdn.com/dms/image/v2/C4E/profile-displayphoto-shrink_400_400/0/1?e=2147483647&v=beta&t=abc',
      },
      commentary: "Joining OpenJS & friends!\nSecond line's end 🎉",
      media: { kind: 'none' },
      reactionCount: 154,
      commentCount: 4,
    });
  });

  it('keeps the repost header line', () => {
    const header =
      '<p class="pb-[10px]" data-test-id="main-feed-activity-card__header">' +
      '<a href="https://www.linkedin.com/company/stripe">Stripe</a> reposted this\n</p>';
    expect(
      parseLinkedInPostCard(embedHtml(`${header}${COMMENTARY}`), URN)
        ?.activityHeader,
    ).toBe('Stripe reposted this');
  });

  it('reads one image and an image grid in order', () => {
    const single = parseLinkedInPostCard(
      embedHtml(
        `${COMMENTARY}<ul data-test-id="feed-images-content">${imageItem(IMAGE_1, 'Stage')}</ul>`,
      ),
      URN,
    );
    expect(single?.media).toEqual({
      kind: 'images',
      images: [
        {
          url: 'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1?e=2147483647&v=beta&t=one',
          alt: 'Stage',
        },
      ],
    });

    const grid = parseLinkedInPostCard(
      embedHtml(
        `<ul data-test-id="feed-images-content">${imageItem(IMAGE_1, '')}${imageItem(IMAGE_2, '')}</ul>`,
      ),
      URN,
    );
    expect(
      grid?.media.kind === 'images'
        ? grid.media.images.map((i) => i.url.slice(-3))
        : [],
    ).toEqual(['one', 'two']);
    expect(grid?.commentary).toBe('');
  });

  it('reads a shared article card', () => {
    const article =
      '<a href="https://www.linkedin.com/pulse/my-annual-letter?trk=public_post_embed_feed-article-content" class="flex flex-col" data-test-id="article-content">' +
      `<img alt="Letter" class="lazy-load" data-delayed-url="${IMAGE_1}">` +
      '<section><header><span data-test-id="article-content__title">\n My annual letter\n</span>' +
      '<span data-test-id="article-content__subtitle">Satya Nadella on LinkedIn</span></header></section></a>';
    expect(
      parseLinkedInPostCard(embedHtml(`${COMMENTARY}${article}`), URN)?.media,
    ).toEqual({
      kind: 'article',
      url: 'https://www.linkedin.com/pulse/my-annual-letter',
      title: 'My annual letter',
      subtitle: 'Satya Nadella on LinkedIn',
      imageUrl:
        'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1?e=2147483647&v=beta&t=one',
    });
  });

  it('reads progressive MP4 sources, poster and aspect ratio of a native video', () => {
    const sources = JSON.stringify([
      {
        src: 'https://dms.licdn.com/playlist/vid/v2/D56/mp4-640p-30fp-crf28/0/1?e=1&v=beta&t=a',
        type: 'video/mp4',
      },
      {
        src: 'https://dms.licdn.com/playlist/vid/v2/D56/hls/0/1.m3u8',
        type: 'application/x-mpegURL',
      },
      { src: 'https://evil.example/video.mp4', type: 'video/mp4' },
    ]).replace(/"/g, '&quot;');
    const video =
      '<div class="share-native-video" data-test-id="feed-native-video-content">' +
      `<video class="share-native-video__node" data-sources="${sources}" data-poster-url="${IMAGE_1}" data-aspect-ratio="1.7777778" playsinline></video></div>`;

    expect(
      parseLinkedInPostCard(embedHtml(`${COMMENTARY}${video}`), URN)?.media,
    ).toEqual({
      kind: 'video',
      sources: [
        'https://dms.licdn.com/playlist/vid/v2/D56/mp4-640p-30fp-crf28/0/1?e=1&v=beta&t=a',
      ],
      posterUrl:
        'https://media.licdn.com/dms/image/v2/D4E/image-shrink_800/0/1?e=2147483647&v=beta&t=one',
      aspectRatio: 1.7777778,
    });
  });

  it('returns null for a video without MP4 sources', () => {
    const video =
      '<div data-test-id="feed-native-video-content"><video data-sources="[]"></video></div>';
    expect(parseLinkedInPostCard(embedHtml(video), URN)).toBeNull();
  });

  it('drops links and media outside LinkedIn hosts', () => {
    const card = parseLinkedInPostCard(
      embedHtml(
        COMMENTARY,
        lockup({
          avatar: 'https://evil.example/a.png',
          href: 'javascript:alert(1)',
        }),
      ),
      URN,
    );
    expect(card?.author).toMatchObject({
      name: 'Matteo Collina',
      profileUrl: null,
      avatarUrl: null,
    });
  });

  it('returns null for blocks the card does not know (reshare, document, …)', () => {
    expect(
      parseLinkedInPostCard(
        embedHtml(
          `${COMMENTARY}<div data-test-id="feed-reshare-content"></div>`,
        ),
        URN,
      ),
    ).toBeNull();
  });

  it('returns null for a page that is not a post card or a bad URN', () => {
    expect(
      parseLinkedInPostCard('<html><body>Page not found</body></html>', URN),
    ).toBeNull();
    expect(
      parseLinkedInPostCard(embedHtml(COMMENTARY), 'urn:li:share:1'),
    ).toBeNull();
  });
});

describe('LinkedIn embed URNs', () => {
  it('accepts post URNs and reads them from embed iframe src', () => {
    expect(isLinkedInEmbedUrn(URN)).toBe(true);
    expect(isLinkedInEmbedUrn('urn:li:person:7523793420038053888')).toBe(false);
    expect(
      linkedInUrnFromEmbedSrc(
        `https://www.linkedin.com/embed/feed/update/${URN}?compact=1`,
      ),
    ).toBe(URN);
    expect(
      linkedInUrnFromEmbedSrc('https://www.youtube.com/embed/abcdefghijk'),
    ).toBeNull();
  });
});

describe('linkedInIframesToCardSlots', () => {
  const iframe = `<iframe src="https://www.linkedin.com/embed/feed/update/${URN}" title="LinkedIn post" frameborder="0" scrolling="no" allowfullscreen loading="lazy"></iframe>`;
  const slot = `<div class="linkedin-post-slot" data-linkedin-urn="${URN}"></div>`;

  it('replaces the pipeline wrapper and its iframe with a card slot', () => {
    expect(
      linkedInIframesToCardSlots(
        `<p>Hi</p><div class="blog-post-linkedin-embed">${iframe}</div><p>Bye</p>`,
      ),
    ).toBe(`<p>Hi</p>${slot}<p>Bye</p>`);
  });

  it('replaces a bare LinkedIn iframe and leaves other iframes alone', () => {
    const youtube =
      '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>';
    expect(linkedInIframesToCardSlots(`${youtube}${iframe}`)).toBe(
      `${youtube}${slot}`,
    );
  });

  it('returns HTML without LinkedIn embeds unchanged', () => {
    const html = '<p>See https://www.linkedin.com/in/someone</p>';
    expect(linkedInIframesToCardSlots(html)).toBe(html);
  });
});

describe('fetchLinkedInPostCard', () => {
  const originalFetch = global.fetch;
  const card = parseLinkedInPostCard(embedHtml(COMMENTARY), URN);

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the BFF card and asks once per URN', async () => {
    const urn = 'urn:li:activity:7523793420834881536';
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ card }),
      }) as typeof fetch;

    await expect(fetchLinkedInPostCard(urn)).resolves.toEqual({
      status: 'card',
      card,
    });
    await fetchLinkedInPostCard(urn);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      '/api/social-embed/linkedin?urn=urn%3Ali%3Aactivity%3A7523793420834881536',
    );
  });

  it('is unavailable for an unsupported layout or a malformed payload', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 422 }) as typeof fetch;
    await expect(
      fetchLinkedInPostCard('urn:li:ugcPost:7518773411293224960'),
    ).resolves.toEqual({
      status: 'unavailable',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        card: { ...card, permalink: 'javascript:alert(1)' },
      }),
    }) as typeof fetch;
    await expect(
      fetchLinkedInPostCard('urn:li:ugcPost:7521256751313375232'),
    ).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
