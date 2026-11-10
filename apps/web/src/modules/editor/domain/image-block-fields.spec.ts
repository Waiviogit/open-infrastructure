import {
  IMAGE_ALT_TEXT_MAX_LENGTH,
  imageBlockMarkdown,
  normalizeImageAltText,
  normalizeImageLinkUrl,
} from './image-block-fields';

describe('normalizeImageLinkUrl', () => {
  it('adds https to a bare domain', () => {
    expect(normalizeImageLinkUrl('  waivio.com ')).toBe('https://waivio.com/');
  });

  it('keeps an http(s) link', () => {
    expect(normalizeImageLinkUrl('http://example.org/a?b=1')).toBe('http://example.org/a?b=1');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c', 'not a url', ''])(
    'rejects %p',
    (input) => {
      expect(normalizeImageLinkUrl(input)).toBeNull();
    },
  );
});

describe('normalizeImageAltText', () => {
  it('keeps the text on one line without markdown brackets', () => {
    expect(normalizeImageAltText(' Cheam [Sushi]\n tray ')).toBe('Cheam Sushi tray');
  });

  it('caps the length', () => {
    expect(normalizeImageAltText('a'.repeat(IMAGE_ALT_TEXT_MAX_LENGTH + 10))).toHaveLength(
      IMAGE_ALT_TEXT_MAX_LENGTH,
    );
  });
});

describe('imageBlockMarkdown', () => {
  const src = 'https://images.hive.blog/p/photo.jpg';

  it('writes a plain image without a link', () => {
    expect(imageBlockMarkdown(src, 'tray', '')).toBe(`![tray](${src})`);
  });

  it('wraps a linked image and encodes parentheses in the target', () => {
    expect(imageBlockMarkdown(src, '', 'https://en.wikipedia.org/wiki/Sushi_(food)')).toBe(
      `[![](${src})](https://en.wikipedia.org/wiki/Sushi_%28food%29)`,
    );
  });

  it('drops a stored link that is not http(s)', () => {
    expect(imageBlockMarkdown(src, 'x', 'javascript:alert(1)')).toBe(`![x](${src})`);
  });
});
