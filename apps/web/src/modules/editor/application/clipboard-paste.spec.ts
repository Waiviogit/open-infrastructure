/** @jest-environment jsdom */
import { clipboardHtmlHasText, singlePastedUrl } from './clipboard-paste';

function clipboard(data: Record<string, string>): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer;
}

describe('singlePastedUrl', () => {
  it('returns the URL only when the clipboard text is exactly one link', () => {
    expect(
      singlePastedUrl(clipboard({ 'text/plain': ' https://x.test/a.jpg \n' })),
    ).toBe('https://x.test/a.jpg');
    expect(
      singlePastedUrl(clipboard({ 'text/plain': 'see https://x.test/a.jpg' })),
    ).toBeNull();
    expect(singlePastedUrl(null)).toBeNull();
  });
});

describe('clipboardHtmlHasText', () => {
  it('is true for a copied page fragment and false for a lone copied image', () => {
    expect(
      clipboardHtmlHasText(
        clipboard({
          'text/html': '<p>Hello <img src="https://x.test/a.jpg"></p>',
        }),
      ),
    ).toBe(true);
    expect(
      clipboardHtmlHasText(
        clipboard({ 'text/html': '<img src="https://x.test/a.jpg">' }),
      ),
    ).toBe(false);
    expect(clipboardHtmlHasText(clipboard({}))).toBe(false);
  });
});
