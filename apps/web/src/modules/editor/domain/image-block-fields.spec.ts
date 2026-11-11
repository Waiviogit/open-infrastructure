import {
  IMAGE_ALT_TEXT_MAX_LENGTH,
  imageBlockMarkdown,
  normalizeImageAltText,
} from './image-block-fields';

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
