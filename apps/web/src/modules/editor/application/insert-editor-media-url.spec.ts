import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from 'lexical';

import { canonicalizeMediaUrl, parseMediaEmbedUrl } from '@/shared/infrastructure/media-embed';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { hasLexicalDraftBodyContent } from './editor-body-serialization';
import { $insertVideoAtSelection } from './insert-editor-media-url';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';

function editorWithParagraph(text: string) {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  editor.update(
    () => {
      const paragraph = $createParagraphNode().append($createTextNode(text));
      $getRoot().append(paragraph);
      paragraph.selectEnd();
    },
    { discrete: true },
  );
  return editor;
}

function insert(editor: ReturnType<typeof createEditor>, url: string): boolean {
  let inserted = false;
  editor.update(
    () => {
      inserted = $insertVideoAtSelection(url);
    },
    { discrete: true },
  );
  return inserted;
}

function state(editor: ReturnType<typeof createEditor>) {
  const json = JSON.stringify(editor.getEditorState().toJSON());
  return {
    json,
    types: editor.getEditorState().read(() => $getRoot().getChildren().map((n) => n.getType())),
    markdown: lexicalStateToMarkdown(json, { resolveImageUrl: (_cid, src) => src }),
  };
}

describe('insert media URL contract', () => {
  it('canonicalizes a valid Instagram URL for markdown storage', () => {
    const raw = 'www.instagram.com/p/DcncWF8DaIb/';
    expect(parseMediaEmbedUrl(raw)).not.toBeNull();
    expect(canonicalizeMediaUrl(raw)).toBe('https://www.instagram.com/p/DcncWF8DaIb/');
  });

  it('rejects non-media URLs', () => {
    expect(parseMediaEmbedUrl('https://example.com/video')).toBeNull();
    expect(parseMediaEmbedUrl('https://www.instagram.com/whitegarden_restaurant/')).toBeNull();
  });
});

describe('inserting a video', () => {
  it('adds an embedded video block with a paragraph after it and publishes the canonical URL', () => {
    const editor = editorWithParagraph('Recipe');

    expect(insert(editor, 'youtu.be/dQw4w9WgXcQ')).toBe(true);

    const { types, markdown } = state(editor);
    expect(types).toEqual(['paragraph', 'post-video', 'paragraph']);
    expect(markdown).toBe('Recipe\n\nhttps://youtu.be/dQw4w9WgXcQ');
  });

  it('inserts nothing for a link that is not a supported video', () => {
    const editor = editorWithParagraph('Recipe');

    expect(insert(editor, 'https://example.com/video')).toBe(false);
    expect(state(editor).types).toEqual(['paragraph']);
  });

  it('counts a video-only body as publishable content', () => {
    const editor = editorWithParagraph('');
    insert(editor, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(hasLexicalDraftBodyContent(state(editor).json)).toBe(true);
  });
});
