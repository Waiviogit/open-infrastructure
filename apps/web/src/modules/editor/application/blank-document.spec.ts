import { $createHeadingNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  createEditor,
  type LexicalNode,
} from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { $createLineNode } from '../domain/nodes/line-node';
import {
  $blankDocumentKeepsFormatting,
  $isBlankDocument,
  $resetBlankDocument,
} from './blank-document';

const FORMAT_BOLD = 1;

function editorWith(build: () => LexicalNode[]) {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.append(...build());
      const last = root.getLastChild();
      if (last && 'select' in last) {
        (last as unknown as { select: () => void }).select();
      }
    },
    { discrete: true },
  );
  return editor;
}

function read<T>(editor: ReturnType<typeof createEditor>, fn: () => T): T {
  return editor.getEditorState().read(fn);
}

describe('blank document', () => {
  it('is blank with one empty paragraph', () => {
    const editor = editorWith(() => [$createParagraphNode()]);
    expect(read(editor, $isBlankDocument)).toBe(true);
    expect(read(editor, $blankDocumentKeepsFormatting)).toBe(false);
  });

  it('is not blank with text, media or several blocks', () => {
    expect(read(editorWith(() => [$createParagraphNode().append($createTextNode('a'))]), $isBlankDocument)).toBe(false);
    expect(read(editorWith(() => [$createLineNode(), $createParagraphNode()]), $isBlankDocument)).toBe(false);
    expect(read(editorWith(() => [$createParagraphNode(), $createParagraphNode()]), $isBlankDocument)).toBe(false);
  });

  it('keeps formatting when the only block is an empty heading', () => {
    const editor = editorWith(() => [$createHeadingNode('h1')]);
    expect(read(editor, $blankDocumentKeepsFormatting)).toBe(true);
  });

  it('keeps formatting when the empty paragraph would type bold', () => {
    const editor = editorWith(() => [$createParagraphNode().setTextFormat(FORMAT_BOLD)]);
    expect(read(editor, $blankDocumentKeepsFormatting)).toBe(true);
  });

  it('resets to one plain paragraph with a plain caret', () => {
    const editor = editorWith(() => [$createHeadingNode('h2')]);
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.format = FORMAT_BOLD;
        }
        $resetBlankDocument();
      },
      { discrete: true },
    );
    read(editor, () => {
      const only = $getRoot().getFirstChild();
      expect($isParagraphNode(only)).toBe(true);
      expect($getRoot().getChildrenSize()).toBe(1);
      const selection = $getSelection();
      expect($isRangeSelection(selection) && selection.format).toBe(0);
    });
    expect(read(editor, $blankDocumentKeepsFormatting)).toBe(false);
  });
});
