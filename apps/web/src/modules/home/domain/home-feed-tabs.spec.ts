import { isHomeFeedPath, resolveActiveHomeFeedTab } from './home-feed-tabs';

describe('resolveActiveHomeFeedTab', () => {
  it.each([
    ['/', 'posts'],
    ['/feed/activity', 'activity'],
    ['/feed/threads', 'threads'],
    ['/feed/updates/', 'updates'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(resolveActiveHomeFeedTab(pathname)).toBe(expected);
  });

  it('returns null outside the home feed', () => {
    expect(resolveActiveHomeFeedTab('/discover')).toBeNull();
    expect(resolveActiveHomeFeedTab('/feed/unknown')).toBeNull();
  });
});

describe('isHomeFeedPath', () => {
  it('matches the root and every feed tab', () => {
    expect(isHomeFeedPath('/')).toBe(true);
    expect(isHomeFeedPath('/feed/threads')).toBe(true);
  });

  it('does not match other hub sections', () => {
    expect(isHomeFeedPath('/discover')).toBe(false);
    expect(isHomeFeedPath('/feedback')).toBe(false);
  });
});
