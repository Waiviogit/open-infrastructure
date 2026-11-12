import { buildActivityMessageExcerpt } from './activity-message-excerpt';

describe('buildActivityMessageExcerpt', () => {
  it('keeps link text and drops markdown markup and images', () => {
    expect(
      buildActivityMessageExcerpt(
        '**New** reel: [watch](https://instagram.com/reel/x) ![cover](https://img.example/a.jpg)',
      ),
    ).toBe('New reel: watch');
  });

  it('flattens code, lists, tables and HTML and hides spoilers', () => {
    expect(
      buildActivityMessageExcerpt(
        '## Menu\n- `soup`\n| Dish | Price |\n|---|---|\n| Tea | $2 |\n<img src="https://img.example/a.jpg"> ||free dessert|| #my_tag',
      ),
    ).toBe('Menu soup Dish · Price Tea · $2 … #my_tag');
  });

  it('returns null when only images remain', () => {
    expect(
      buildActivityMessageExcerpt('![](https://img.example/a.jpg)'),
    ).toBeNull();
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
