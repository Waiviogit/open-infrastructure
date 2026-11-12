import { lexicalStateToMarkdown } from './lexical-state-to-markdown';

const resolveImageUrl = (cid: string, src: string) =>
  cid ? `https://ipfs.example/ipfs/${cid}` : src;

describe('lexicalStateToMarkdown', () => {
  it('returns plain string when not JSON', () => {
    expect(lexicalStateToMarkdown('hello', { resolveImageUrl })).toBe('hello');
  });

  it('converts paragraph and bold text', () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Hello ', format: 0 },
              { type: 'text', text: 'world', format: 1 },
            ],
          },
        ],
      },
    });
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe('Hello **world**');
  });

  it('converts heading and link', () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: 'heading',
            tag: 'h2',
            children: [{ type: 'text', text: 'Title', format: 0 }],
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com',
                children: [{ type: 'text', text: 'link', format: 0 }],
              },
            ],
          },
        ],
      },
    });
    const md = lexicalStateToMarkdown(json, { resolveImageUrl });
    expect(md).toContain('## Title');
    expect(md).toContain('[link](https://example.com)');
  });

  it('converts post-image node', () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: 'post-image',
            cid: 'QmTest',
            src: '',
            altText: 'pic',
            children: [],
          },
        ],
      },
    });
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      '![pic](https://ipfs.example/ipfs/QmTest)',
    );
  });

  it('wraps a linked post-image in a markdown link', () => {
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: 'post-image',
            cid: 'QmTest',
            src: '',
            altText: 'pic',
            linkUrl: 'https://waivio.com/',
            children: [],
          },
        ],
      },
    });
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      '[![pic](https://ipfs.example/ipfs/QmTest)](https://waivio.com/)',
    );
  });
});

describe('lexicalStateToMarkdown heading line breaks', () => {
  it('turns each line of a heading with soft line breaks into its own heading', () => {
    const br = { type: 'linebreak' };
    const json = JSON.stringify({
      root: {
        children: [
          {
            type: 'heading',
            tag: 'h2',
            children: [
              {
                type: 'link',
                url: 'https://google.com/',
                children: [{ type: 'text', text: 'some text', format: 0 }],
              },
              br,
              br,
              br,
              { type: 'text', text: 'Head 1', format: 0 },
              br,
              br,
              br,
              { type: 'text', text: 'head 2', format: 0 },
            ],
          },
          { type: 'paragraph', children: [] },
          {
            type: 'heading',
            tag: 'h3',
            children: [{ type: 'text', text: 'head 3', format: 0 }],
          },
        ],
      },
    });
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      '## [some text](https://google.com/)\n\n## Head 1\n\n## head 2\n\n### head 3',
    );
  });
});

function paragraphs(...children: unknown[][]): string {
  return JSON.stringify({
    root: { children: children.map((c) => ({ type: 'paragraph', children: c })) },
  });
}

const text = (value: string, format = 0) => ({ type: 'text', text: value, format });

describe('lexicalStateToMarkdown escaping', () => {
  it('keeps an autolinked URL with `_` and `#` working', () => {
    const url = 'https://x.com/a_b#c';
    const json = paragraphs([
      text('see '),
      { type: 'autolink', url, children: [text(url)] },
    ]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      `see [${url}](${url})`,
    );
  });

  it('leaves hashtags and snake_case words unescaped', () => {
    const json = paragraphs([text('tags #my_tag #objectid and snake_case')]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      'tags #my_tag #objectid and snake_case',
    );
  });

  it('keeps a hashtag that starts a line', () => {
    const json = paragraphs([text('#objectid')]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe('#objectid');
  });

  it('escapes a line-start `#` that would make a heading', () => {
    const json = paragraphs([text('# not a heading'), { type: 'linebreak' }, text('## nor this')]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      '\\# not a heading\n\\## nor this',
    );
  });

  it('escapes `_` and `*` that would open emphasis', () => {
    const json = paragraphs([text('_lead_ a*b* 2 * 3')]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      '\\_lead\\_ a\\*b\\* 2 * 3',
    );
  });

  it('keeps inline code raw, fenced past its own backticks', () => {
    const FORMAT_CODE = 16;
    const json = paragraphs([
      text('run '),
      text('my_var * 2', FORMAT_CODE),
      text(' or '),
      text('a`b', FORMAT_CODE),
    ]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      'run `my_var * 2` or ``a`b``',
    );
  });

  it('emits an inline spoiler as ||…||', () => {
    const json = paragraphs([
      text('the end: '),
      { type: 'spoiler', children: [text('he lives')] },
      text('!'),
    ]);
    expect(lexicalStateToMarkdown(json, { resolveImageUrl })).toBe(
      'the end: ||he lives||!',
    );
  });
});
