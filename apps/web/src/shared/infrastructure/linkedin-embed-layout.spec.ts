import {
  estimateLinkedInEmbedHeight,
  isLinkedInEmbedUrn,
  linkedInCommentaryWidth,
  linkedInUrnFromEmbedSrc,
  parseLinkedInEmbedLayout,
} from './linkedin-embed-layout';

const AUTHOR = '<div data-test-id="main-feed-activity-embed-card__entity-lockup"><a>Matteo</a></div>';
const SOCIAL =
  '<div data-test-id="main-feed-activity-embed-card__social-actions">' +
  '<span data-test-id="social-actions__reaction-count">16</span>' +
  '<a data-test-id="social-actions__comments">4 Comments</a></div>';

function embedHtml(body: string): string {
  return `<html><body><article>${AUTHOR}${body}${SOCIAL}</article></body></html>`;
}

const COMMENTARY =
  '<p class="attributed-text-segment-list__content" dir="ltr" data-test-id="main-feed-activity-embed-card__commentary">' +
  'Joining <a class="link" href="https://www.linkedin.com/company/x">OpenJS &amp; friends</a>!\n\nSecond line&#39;s end &#x1F389;</p>';

describe('parseLinkedInEmbedLayout', () => {
  it('reads a text-only post as plain text with line breaks', () => {
    expect(parseLinkedInEmbedLayout(embedHtml(COMMENTARY))).toEqual({
      commentary: "Joining OpenJS & friends!\n\nSecond line's end 🎉",
      hasActivityHeader: false,
      media: 'none',
    });
  });

  it('detects the repost header, one image and an image grid', () => {
    const header = '<p data-test-id="main-feed-activity-card__header">Matteo reposted this</p>';
    const item = '<li data-test-id="feed-images-content__list-item"><img alt></li>';
    const single = parseLinkedInEmbedLayout(
      embedHtml(`${header}${COMMENTARY}<ul data-test-id="feed-images-content">${item}</ul>`),
    );
    expect(single).toMatchObject({ hasActivityHeader: true, media: 'image' });
    const grid = parseLinkedInEmbedLayout(
      embedHtml(`${COMMENTARY}<ul data-test-id="feed-images-content">${item}${item}${item}</ul>`),
    );
    expect(grid?.media).toBe('image-grid');
  });

  it('detects a shared article card', () => {
    const article =
      '<a data-test-id="article-content"><h3 data-test-id="article-content__title">T</h3>' +
      '<h4 data-test-id="article-content__subtitle">S</h4></a>';
    expect(parseLinkedInEmbedLayout(embedHtml(`${COMMENTARY}${article}`))?.media).toBe('article');
  });

  it('returns null for blocks it cannot size (video, document, …)', () => {
    expect(
      parseLinkedInEmbedLayout(embedHtml(`${COMMENTARY}<div data-test-id="feed-video-content"></div>`)),
    ).toBeNull();
  });

  it('returns null for a page that is not a post card', () => {
    expect(parseLinkedInEmbedLayout('<html><body>Page not found</body></html>')).toBeNull();
  });
});

describe('estimateLinkedInEmbedHeight', () => {
  const textOnly = { commentary: 'x', hasActivityHeader: false, media: 'none' } as const;

  it('adds card chrome and a small safety margin to the commentary height', () => {
    // Live embed at 340px: 7 commentary lines (147px) render a 328px card.
    expect(estimateLinkedInEmbedHeight(textOnly, 147)).toBe(336);
  });

  it('adds the repost header and the media block', () => {
    // Live embed at 420px: repost header, 35 lines (735px), image grid → 1320px.
    expect(
      estimateLinkedInEmbedHeight({ ...textOnly, hasActivityHeader: true, media: 'image-grid' }, 735),
    ).toBe(1328);
  });

  it('never estimates below the real card for one image (aspect is unknown)', () => {
    // Live embed at 540px: one landscape image, one line → 564px.
    expect(estimateLinkedInEmbedHeight({ ...textOnly, media: 'image' }, 21)).toBeGreaterThanOrEqual(564);
  });
});

describe('LinkedIn embed URNs', () => {
  it('reads the URN from an embed iframe src', () => {
    expect(
      linkedInUrnFromEmbedSrc(
        'https://www.linkedin.com/embed/feed/update/urn:li:share:7528142279761571840?collapsed=1',
      ),
    ).toBe('urn:li:share:7528142279761571840');
    expect(linkedInUrnFromEmbedSrc('https://www.youtube.com/embed/abcdefghijk')).toBeNull();
    expect(
      linkedInUrnFromEmbedSrc('https://evil.example/www.linkedin.com/embed/feed/update/urn:li:share:7528142279761571840'),
    ).toBeNull();
  });

  it('accepts only post URNs', () => {
    expect(isLinkedInEmbedUrn('urn:li:activity:7528142280243847168')).toBe(true);
    expect(isLinkedInEmbedUrn('urn:li:ugcPost:7528142280243847168')).toBe(true);
    expect(isLinkedInEmbedUrn('urn:li:share:123')).toBe(false);
    expect(isLinkedInEmbedUrn('urn:li:share:7528142279761571840/../x')).toBe(false);
  });

  it('wraps commentary inside the card border and padding', () => {
    expect(linkedInCommentaryWidth(340)).toBe(306);
    expect(linkedInCommentaryWidth(10)).toBe(0);
  });
});
