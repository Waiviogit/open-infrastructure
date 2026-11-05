import { extractPastedObjectIds, PASTED_OBJECT_IDS_MAX } from './extract-pasted-object-ids';

describe('extractPastedObjectIds', () => {
  it('collects object ids from links in pasted HTML on any host and relative paths', () => {
    const html = [
      '<a href="https://waivio.com/object/abc-cafe">Cafe</a>',
      '<a href="/object/xyz/page#menu">XYZ</a>',
      '<a href="https://x.com/y">other</a>',
    ].join(' ');

    expect(extractPastedObjectIds(html, null)).toEqual(['abc-cafe', 'xyz']);
  });

  it('collects object ids from URLs in plain text', () => {
    expect(
      extractPastedObjectIds(null, 'see https://example.org/object/pizza-place and /object/ab%20c'),
    ).toEqual(['pizza-place', 'ab c']);
  });

  it('returns nothing for plain text without object links', () => {
    expect(extractPastedObjectIds(null, 'just some words https://x.com/a')).toEqual([]);
  });

  it('deduplicates ids that appear in both HTML and text', () => {
    expect(
      extractPastedObjectIds(
        '<a href="https://waivio.com/object/abc">x</a>',
        'https://waivio.com/object/abc',
      ),
    ).toEqual(['abc']);
  });

  it('caps the number of ids from one paste', () => {
    const text = Array.from({ length: PASTED_OBJECT_IDS_MAX + 5 }, (_, i) => `/object/o${i}`).join(' ');

    expect(extractPastedObjectIds(null, text)).toHaveLength(PASTED_OBJECT_IDS_MAX);
  });
});
