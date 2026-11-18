import { objectPageHidesRightRail } from './html-object.constants';
import {
  buildHtmlEditorMarkdown,
  extractHtmlFromEditorMarkdown,
  looksLikeHtmlSource,
  normalizeHtmlContentSource,
} from './html-content-source';

const PAGE = '<!DOCTYPE html>\n<html lang="en">\n<body><h1>Hi</h1></body>\n</html>';

describe('normalizeHtmlContentSource', () => {
  it('unwraps the legacy ```javascript fence', () => {
    expect(normalizeHtmlContentSource('```javascript\n' + PAGE + '\n```')).toBe(PAGE);
  });

  it('keeps raw HTML as is', () => {
    expect(normalizeHtmlContentSource(`  ${PAGE}\n`)).toBe(PAGE);
  });

  it('unwraps <pre><code> and decodes its entities', () => {
    expect(
      normalizeHtmlContentSource('<pre><code>&lt;p class=&quot;a&quot;&gt;x &amp; y&lt;/p&gt;</code></pre>'),
    ).toBe('<p class="a">x & y</p>');
  });

  it('decodes fully escaped markup', () => {
    expect(normalizeHtmlContentSource('&lt;div&gt;x&lt;/div&gt;')).toBe('<div>x</div>');
  });

  it('does not decode entities inside real markup', () => {
    expect(normalizeHtmlContentSource('<p>a &lt; b</p>')).toBe('<p>a &lt; b</p>');
  });

  it('returns an empty string for null', () => {
    expect(normalizeHtmlContentSource(null)).toBe('');
  });
});

describe('looksLikeHtmlSource', () => {
  it('accepts markup and a doctype', () => {
    expect(looksLikeHtmlSource('<div>x</div>')).toBe(true);
    expect(looksLikeHtmlSource('<!doctype html>')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(looksLikeHtmlSource('just words, 1 < 2')).toBe(false);
  });
});

describe('editor round trip', () => {
  it('extracts the source the editor was seeded with', () => {
    expect(extractHtmlFromEditorMarkdown(buildHtmlEditorMarkdown(PAGE))).toEqual({
      ok: true,
      html: PAGE,
    });
  });

  it('uses a longer fence when the source contains backticks', () => {
    const source = '<script>const s = `a ``` b`;</script>';
    const markdown = buildHtmlEditorMarkdown(source);
    expect(markdown.startsWith('````html\n')).toBe(true);
    expect(extractHtmlFromEditorMarkdown(markdown)).toEqual({ ok: true, html: source });
  });
});

describe('extractHtmlFromEditorMarkdown', () => {
  it('reports an empty body or an empty code block', () => {
    expect(extractHtmlFromEditorMarkdown('  ')).toEqual({ ok: false, error: 'empty' });
    expect(extractHtmlFromEditorMarkdown('```html\n\n```')).toEqual({ ok: false, error: 'empty' });
  });

  it('requires the page to be in a code block', () => {
    expect(extractHtmlFromEditorMarkdown('<div>typed as text</div>')).toEqual({
      ok: false,
      error: 'code_block_required',
    });
  });

  it('rejects text around the code block', () => {
    expect(extractHtmlFromEditorMarkdown('Intro\n\n```html\n<p>x</p>\n```')).toEqual({
      ok: false,
      error: 'code_block_required',
    });
  });

  it('rejects two code blocks with text between them', () => {
    expect(
      extractHtmlFromEditorMarkdown('```html\n<p>a</p>\n```\n\nmiddle\n\n```html\n<p>b</p>\n```'),
    ).toEqual({ ok: false, error: 'code_block_required' });
  });

  it('rejects a code block without HTML', () => {
    expect(extractHtmlFromEditorMarkdown('```js\nconsole.log(1)\n```')).toEqual({
      ok: false,
      error: 'not_html',
    });
  });
});

describe('objectPageHidesRightRail', () => {
  it('hides the right rail only on the HTML tab of html objects', () => {
    expect(objectPageHidesRightRail('html', 'html')).toBe(true);
    expect(objectPageHidesRightRail('html', 'social')).toBe(false);
    expect(objectPageHidesRightRail('page', 'html')).toBe(false);
  });
});
