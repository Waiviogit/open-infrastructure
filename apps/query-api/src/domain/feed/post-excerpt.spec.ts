import { FEED_EXCERPT_MAX_LENGTH } from './feed.constants';
import { stripHtmlForExcerpt, truncateExcerpt } from './post-excerpt';

describe('stripHtmlForExcerpt', () => {
  it('drops HTML tags and collapses whitespace', () => {
    expect(stripHtmlForExcerpt('<p>Hello</p>\n\n<p>  world </p>')).toBe(
      'Hello world',
    );
  });

  it('returns plain text for a markdown thread body', () => {
    const body = [
      '## Recipe',
      '',
      '- **flour** 200g',
      '- [salt](https://example.com/salt)',
      '',
      '| Step | Time |',
      '|---|---|',
      '| Bake | 20m |',
      '',
      '```',
      'oven = 180',
      '```',
      '',
      '![photo](https://img.example/p.jpg)',
      '||the secret ingredient||',
      '',
      '#my_tag \\#escaped',
    ].join('\n');
    expect(stripHtmlForExcerpt(body)).toBe(
      'Recipe flour 200g salt Step · Time Bake · 20m oven = 180 … #my_tag #escaped',
    );
  });

  it('handles Hive HTML bodies with markdown inside', () => {
    expect(
      stripHtmlForExcerpt(
        '<center>![](https://img.example/a.jpg)</center>\n<div class="text-justify">\n\n**Hi** there\n\n</div>',
      ),
    ).toBe('Hi there');
  });

  it('returns an empty string for image-only bodies', () => {
    expect(
      stripHtmlForExcerpt(
        '![](https://img.example/a.jpg)\n<img src="https://img.example/b.jpg">',
      ),
    ).toBe('');
  });
});

describe('truncateExcerpt', () => {
  it('keeps short text as is', () => {
    expect(truncateExcerpt('short')).toBe('short');
  });

  it('cuts at the last space with an ellipsis', () => {
    const text = 'word '.repeat(FEED_EXCERPT_MAX_LENGTH);
    const excerpt = truncateExcerpt(text);
    expect(excerpt.endsWith('word…')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(FEED_EXCERPT_MAX_LENGTH + 1);
  });
});
