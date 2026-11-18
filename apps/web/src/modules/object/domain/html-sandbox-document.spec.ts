import { HTML_SANDBOX_MESSAGE_SOURCE } from './html-object.constants';
import {
  buildHtmlSandboxDocument,
  buildHtmlSandboxViewportMessage,
  parseHtmlSandboxResizeMessage,
  rewriteViewportHeightUnits,
} from './html-sandbox-document';

const OPTIONS = { viewportHeight: 900 };

describe('buildHtmlSandboxDocument', () => {
  it('builds in the window height for vh and hides the frame scrollbars', () => {
    const doc = buildHtmlSandboxDocument('<p>x</p>', OPTIONS);
    expect(doc).toContain('setVh(900);');
    expect(doc).toContain("root.style.setProperty('overflow','hidden','important');");
  });

  it('injects the bootstrap at the top of an existing <head>', () => {
    const doc = buildHtmlSandboxDocument(
      '<!doctype html><html><head lang="x"><title>T</title></head><body>B</body></html>',
      OPTIONS,
    );
    expect(doc.startsWith('<!doctype html><html><head lang="x"><script>')).toBe(true);
    expect(doc).toContain('</script><title>T</title>');
  });

  it('does not mistake <header> for <head>', () => {
    const doc = buildHtmlSandboxDocument('<html><body><header>H</header></body></html>', OPTIONS);
    expect(doc.startsWith('<html><head><script>')).toBe(true);
    expect(doc).toContain('<header>H</header>');
  });

  it('wraps a fragment in a full document', () => {
    const doc = buildHtmlSandboxDocument('<p>x</p>', OPTIONS);
    expect(doc.startsWith('<!doctype html><html><head>')).toBe(true);
    expect(doc).toContain('<body><p>x</p></body></html>');
  });

  it('rewrites vh in the page it embeds', () => {
    const doc = buildHtmlSandboxDocument('<style>.hero{min-height:100vh}</style><p>x</p>', OPTIONS);
    expect(doc).toContain('.hero{min-height:calc(var(--odl-vh) * 100)}');
  });
});

describe('rewriteViewportHeightUnits', () => {
  it('rewrites vh, dvh, svh and lvh lengths in style blocks', () => {
    expect(
      rewriteViewportHeightUnits(
        '<style>a{height:100vh;top:-50vh;max-height:.5dvh}b{min-height:calc(100svh - 2rem)}</style>',
      ),
    ).toBe(
      '<style>a{height:calc(var(--odl-vh) * 100);top:calc(var(--odl-vh) * -50);' +
        'max-height:calc(var(--odl-vh) * .5)}b{min-height:calc(calc(var(--odl-vh) * 100) - 2rem)}</style>',
    );
  });

  it('rewrites vh in style attributes', () => {
    expect(rewriteViewportHeightUnits('<div style="height: 80vh">x</div>')).toBe(
      '<div style="height: calc(var(--odl-vh) * 80)">x</div>',
    );
  });

  it('leaves class names, text and scripts alone', () => {
    const source =
      '<style>.h-100vh{color:red}</style><p>Fill 100vh of the screen</p><script>el.style.height="100vh"</script>';
    expect(rewriteViewportHeightUnits(source)).toBe(source);
  });
});

describe('sandbox messages', () => {
  it('builds the viewport message the bootstrap listens for', () => {
    expect(buildHtmlSandboxViewportMessage(900)).toEqual({
      source: HTML_SANDBOX_MESSAGE_SOURCE,
      type: 'viewport',
      height: 900,
    });
  });

  it('accepts a resize message from the bootstrap', () => {
    expect(
      parseHtmlSandboxResizeMessage({
        source: HTML_SANDBOX_MESSAGE_SOURCE,
        type: 'resize',
        height: 640,
        complete: true,
      }),
    ).toEqual({ height: 640, complete: true });
    expect(
      parseHtmlSandboxResizeMessage({ source: HTML_SANDBOX_MESSAGE_SOURCE, type: 'resize', height: 1 }),
    ).toEqual({ height: 1, complete: false });
  });

  it('ignores other messages', () => {
    expect(parseHtmlSandboxResizeMessage({ source: 'other', type: 'resize', height: 1 })).toBeNull();
    expect(
      parseHtmlSandboxResizeMessage({ source: HTML_SANDBOX_MESSAGE_SOURCE, type: 'resize', height: -1 }),
    ).toBeNull();
    expect(parseHtmlSandboxResizeMessage('resize')).toBeNull();
  });
});
