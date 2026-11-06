/** @jest-environment jsdom */
import { $insertGeneratedNodes } from '@lexical/clipboard';
import { $generateNodesFromDOM } from '@lexical/html';
import { $getRoot, $getSelection, createEditor } from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';
import { normalizePastedHtml } from './normalize-pasted-html';

const IMAGE_URL = 'https://example.com/photo.jpg';
const PROXIED_IMAGE = `https://images.hive.blog/0x0/${IMAGE_URL}`;
const YOUTUBE_EMBED =
  '<div class="blog-post-youtube-embed"><iframe src="https://www.youtube.com/embed/vJgM9oF7siA" title="YouTube video"></iframe></div>';

/** Clipboard HTML Chrome writes for a selection of a rendered post (styles removed). */
const COPIED_POST_HTML = [
  '<h2>Section heading</h2>',
  '<p>Plain start with<span>&nbsp;</span><strong>bold words</strong>,<span>&nbsp;</span><em>italic words</em>,<span>&nbsp;</span><del>struck words</del><span>&nbsp;</span>and a<span>&nbsp;</span><a href="https://example.com/docs">docs link</a>.</p>',
  `<p><img src="${PROXIED_IMAGE}" alt="e2e photo" data-fallback-src="${IMAGE_URL}"></p>`,
  '<ul><li>first bullet</li><li>second bullet</li></ul>',
  '<ol><li>first step</li><li>second step</li></ol>',
  '<blockquote><p>quoted line</p></blockquote>',
  '<p>Use<span>&nbsp;</span><code>inline code</code><span>&nbsp;</span>here.</p>',
  '<pre><code>const answer = 42;\n</code></pre>',
  '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>alpha</td><td>1</td></tr></tbody></table>',
  '<hr><p></p>',
  YOUTUBE_EMBED,
  '<p></p><p>Closing paragraph.</p>',
].join('');

function normalized(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  normalizePastedHtml(doc);
  return doc.body.innerHTML;
}

/** Same steps as the rich paste plugin, into an empty headless editor. */
function paste(html: string) {
  const editor = createEditor({
    nodes: [...POST_EDITOR_NODES],
    onError: (e) => {
      throw e;
    },
  });
  editor.update(
    () => {
      $getRoot().selectEnd();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      normalizePastedHtml(doc);
      const selection = $getSelection();
      if (!selection) {
        throw new Error('no selection');
      }
      $insertGeneratedNodes(
        editor,
        $generateNodesFromDOM(editor, doc),
        selection,
      );
    },
    { discrete: true },
  );
  const state = editor.getEditorState();
  const json = JSON.stringify(state.toJSON());
  return {
    types: state.read(() =>
      $getRoot()
        .getChildren()
        .map((n) => n.getType()),
    ),
    markdown: lexicalStateToMarkdown(json, {
      resolveImageUrl: (_cid, src) => src,
    }),
  };
}

describe('pasting a copied post', () => {
  it('keeps every block the post shows, in order', () => {
    expect(paste(COPIED_POST_HTML).types).toEqual([
      'heading',
      'paragraph',
      'post-image',
      'list',
      'list',
      'quote',
      'paragraph',
      'code',
      'table',
      'horizontalrule',
      'post-video',
      'paragraph',
    ]);
  });

  it('publishes the same markdown the post was written in', () => {
    const { markdown } = paste(COPIED_POST_HTML);
    expect(markdown).toContain('## Section heading');
    expect(markdown).toContain(
      'Plain start with **bold words**, *italic words*, ~~struck words~~ and a [docs link](https://example.com/docs).',
    );
    expect(markdown).toContain(`![e2e photo](${IMAGE_URL})`);
    expect(markdown).toContain('- first bullet\n- second bullet');
    expect(markdown).toContain('1. first step\n2. second step');
    expect(markdown).toContain('> quoted line');
    expect(markdown).toContain('Use `inline code` here.');
    expect(markdown).toContain('```\nconst answer = 42;\n```');
    expect(markdown).toContain('| Name | Value |');
    expect(markdown).toContain('---');
    expect(markdown).toContain('https://www.youtube.com/watch?v=vJgM9oF7siA');
    expect(markdown).toContain('Closing paragraph.');
    expect(markdown).not.toContain(String.fromCharCode(0xa0));
  });
});

describe('normalizePastedHtml', () => {
  it('lifts an image out of its paragraph and link, splitting the text around it', () => {
    expect(
      normalized(
        `<p>before <a href="https://x.test"><img src="${IMAGE_URL}"></a> after</p>`,
      ),
    ).toBe(`<p>before </p><img src="${IMAGE_URL}"><p> after</p>`);
  });

  it('keeps the original URL of an image shown through the Hive proxy', () => {
    expect(
      paste(`<p><img src="${PROXIED_IMAGE}" alt="a"></p>`).markdown,
    ).toContain(`![a](${IMAGE_URL})`);
  });

  it('turns an image inside a list item or table cell into a link', () => {
    expect(
      normalized(`<ul><li>see <img src="${IMAGE_URL}" alt="pic"></li></ul>`),
    ).toBe(`<ul><li>see <a href="${IMAGE_URL}">pic</a></li></ul>`);
    expect(
      normalized(
        `<table><tbody><tr><td><img src="${IMAGE_URL}"></td></tr></tbody></table>`,
      ),
    ).toBe(
      `<table><tbody><tr><td><a href="${IMAGE_URL}">${IMAGE_URL}</a></td></tr></tbody></table>`,
    );
  });

  it('drops images that cannot be published (inline data, relative paths)', () => {
    expect(
      normalized(
        '<p>a<img src="data:image/png;base64,AAAA">b<img src="/x.png"></p>',
      ),
    ).toBe('<p>ab</p>');
  });

  it('keeps a player the editor cannot embed as a link to its page', () => {
    expect(
      normalized(
        '<div><iframe src="https://play.3speak.tv/watch?v=alice/abc&amp;mode=iframe"></iframe></div>',
      ),
    ).toBe(
      '<div><a href="https://3speak.tv/watch?v=alice/abc">https://3speak.tv/watch?v=alice/abc</a></div>',
    );
    expect(
      normalized('<p><iframe src="https://maps.example/embed"></iframe></p>'),
    ).toBe('');
  });

  it('marks deleted text as struck and joins a <pre><code> pair into one code block', () => {
    expect(normalized('<p><del>a</del><strike>b</strike></p>')).toBe(
      '<p><s>a</s><s>b</s></p>',
    );
    expect(normalized('<pre><code>x\ny\n\n</code></pre>')).toBe(
      '<pre>x\ny</pre>',
    );
  });

  it('turns centered content into a block container and removes empty paragraphs', () => {
    expect(
      normalized(
        `<center><img src="${IMAGE_URL}"></center><p>&nbsp;</p><p><br></p>`,
      ),
    ).toBe(`<div><img src="${IMAGE_URL}"></div>`);
  });
});
