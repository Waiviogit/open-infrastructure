import { normalizeTextLinkUrl, normalizeWebLinkUrl } from './link-url';

describe('normalizeWebLinkUrl', () => {
  it('adds https to a bare domain', () => {
    expect(normalizeWebLinkUrl('  waivio.com ')).toBe('https://waivio.com/');
    expect(normalizeWebLinkUrl('google.com/search?q=1')).toBe('https://google.com/search?q=1');
  });

  it('adds https to a protocol-relative link', () => {
    expect(normalizeWebLinkUrl('//x.com/a')).toBe('https://x.com/a');
  });

  it('keeps an http(s) link', () => {
    expect(normalizeWebLinkUrl('http://example.org/a?b=1')).toBe('http://example.org/a?b=1');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'mailto:a@b.c',
    '/object/abc',
    'not a url',
    '',
  ])('rejects %p', (input) => {
    expect(normalizeWebLinkUrl(input)).toBeNull();
  });
});

describe('normalizeTextLinkUrl', () => {
  it('keeps a mailto link', () => {
    expect(normalizeTextLinkUrl(' mailto:a@b.c ')).toBe('mailto:a@b.c');
  });

  it('adds https to a bare domain', () => {
    expect(normalizeTextLinkUrl('google.com')).toBe('https://google.com/');
  });

  it.each(['mailto:', 'javascript:alert(1)', 'data:text/html,x', '/path', 'not a url', ''])(
    'rejects %p',
    (input) => {
      expect(normalizeTextLinkUrl(input)).toBeNull();
    },
  );
});
