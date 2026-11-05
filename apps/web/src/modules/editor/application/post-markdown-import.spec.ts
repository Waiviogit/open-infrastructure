import { $getRoot, createEditor } from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';
import { $importPostMarkdown, splitMarkdownTableRow } from './post-markdown-import';

const resolveImageUrl = (cid: string, src: string) =>
  cid ? `https://odl.example/ipfs-gateway/content/image/${cid}` : src;

function importMarkdown(markdown: string) {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  editor.update(() => $importPostMarkdown(markdown), { discrete: true });
  const json = JSON.stringify(editor.getEditorState().toJSON());
  const types = editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((n) => n.getType()),
  );
  return { json, types, markdown: lexicalStateToMarkdown(json, { resolveImageUrl }) };
}

describe('importing a published post body', () => {
  it('rebuilds headings, lists, quotes, links, images, rules, code and tables', () => {
    const source = [
      '## Best pizza',
      '',
      'Try [Cafe Kyiv](https://waivio.com/object/abc-cafe-kyiv) **today**.',
      '',
      '- crust',
      '- cheese',
      '',
      '> great place',
      '',
      '![front](https://odl.example/ipfs-gateway/content/image/bafyphoto)',
      '',
      '---',
      '',
      '```js',
      'const x = 1;',
      '```',
      '',
      '| dish | price |',
      '| --- | --- |',
      '| pizza | 10 |',
    ].join('\n');

    const result = importMarkdown(source);

    expect(result.types).toEqual([
      'heading',
      'paragraph',
      'list',
      'quote',
      'post-image',
      'horizontalrule',
      'code',
      'table',
    ]);
    expect(result.markdown).toBe(source);
  });

  it('keeps the IPFS CID of an imported gateway image', () => {
    const { json } = importMarkdown('![](https://odl.example/ipfs-gateway/content/image/bafyphoto)');

    expect(json).toContain('"cid":"bafyphoto"');
  });

  it('turns a bare image URL line into an image', () => {
    const { types } = importMarkdown('https://images.hive.blog/p/photo.jpg');

    expect(types).toEqual(['post-image']);
  });

  it('builds a table without header when there is no divider row', () => {
    const { markdown } = importMarkdown('| a | b |\n| c | d |');

    expect(markdown).toBe('|  |  |\n| --- | --- |\n| a | b |\n| c | d |');
  });
});

describe('importing video links', () => {
  it('turns a bare YouTube URL line into an embedded video and publishes it back as the URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const result = importMarkdown(`Watch this\n\n${url}\n\nNice`);

    expect(result.types).toEqual(['paragraph', 'post-video', 'paragraph']);
    expect(result.markdown).toBe(`Watch this\n\n${url}\n\nNice`);
  });

  it('turns an old draft linked video paragraph into an embedded video', () => {
    const url = 'https://www.instagram.com/p/DcncWF8DaIb/';
    const { types, markdown } = importMarkdown(`[${url}](${url})`);

    expect(types).toEqual(['post-video']);
    expect(markdown).toBe(url);
  });

  it('keeps a non-video link as a normal paragraph link', () => {
    const { types } = importMarkdown('https://example.com/article');

    expect(types).toEqual(['paragraph']);
  });
});

describe('splitMarkdownTableRow', () => {
  it('splits on unescaped pipes and unescapes \\|', () => {
    expect(splitMarkdownTableRow(' a\\|b | c ')).toEqual(['a|b', 'c']);
  });
});
