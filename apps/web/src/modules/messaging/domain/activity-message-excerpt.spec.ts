import { buildActivityMessageExcerpt } from './activity-message-excerpt';

describe('buildActivityMessageExcerpt', () => {
  it('keeps link text and drops markdown markup and images', () => {
    expect(
      buildActivityMessageExcerpt(
        '**New** reel: [watch](https://instagram.com/reel/x) ![cover](https://img.example/a.jpg)',
      ),
    ).toBe('New reel: watch');
  });

  it('truncates long bodies with an ellipsis', () => {
    const excerpt = buildActivityMessageExcerpt('word '.repeat(100), 20);
    expect(excerpt).toHaveLength(20);
    expect(excerpt?.endsWith('…')).toBe(true);
  });

  it('returns null for empty bodies', () => {
    expect(buildActivityMessageExcerpt(null)).toBeNull();
    expect(buildActivityMessageExcerpt('   ')).toBeNull();
  });
});
