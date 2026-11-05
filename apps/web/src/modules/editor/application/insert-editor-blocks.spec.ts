import { $createCodeNode } from '@lexical/code';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { $convertCaretBlockToCode, $insertHorizontalRuleAtCaret } from './insert-editor-blocks';

function editorWith(build: () => { blocks: LexicalNode[]; caret: () => void }): LexicalEditor {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  editor.update(
    () => {
      const { blocks, caret } = build();
      $getRoot().clear().append(...blocks);
      caret();
    },
    { discrete: true },
  );
  return editor;
}

function run(editor: LexicalEditor, fn: () => void): void {
  editor.update(fn, { discrete: true });
}

function blocks(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((n) => `${n.getType()}:${n.getType() === 'horizontalrule' ? '' : n.getTextContent()}`),
  );
}

function caretBlockIndex(editor: LexicalEditor): number {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return -1;
    }
    return selection.anchor.getNode().getTopLevelElementOrThrow().getIndexWithinParent();
  });
}

describe('Insert → Line', () => {
  it('goes after a code block without splitting it and moves the caret below the rule', () => {
    const editor = editorWith(() => {
      const text = $createTextNode('const yo = 2;');
      return { blocks: [$createCodeNode().append(text)], caret: () => text.select(5, 5) };
    });

    run(editor, $insertHorizontalRuleAtCaret);

    expect(blocks(editor)).toEqual(['code:const yo = 2;', 'horizontalrule:', 'paragraph:']);
    expect(caretBlockIndex(editor)).toBe(2);
  });

  it('goes before an empty paragraph and keeps the caret in that paragraph', () => {
    const editor = editorWith(() => {
      const empty = $createParagraphNode();
      return {
        blocks: [$createParagraphNode().append($createTextNode('Intro')), empty],
        caret: () => empty.select(),
      };
    });

    run(editor, $insertHorizontalRuleAtCaret);

    expect(blocks(editor)).toEqual(['paragraph:Intro', 'horizontalrule:', 'paragraph:']);
    expect(caretBlockIndex(editor)).toBe(2);
  });
});

describe('Insert → Code', () => {
  it('turns the caret block into a code block and keeps the following block', () => {
    const editor = editorWith(() => {
      const text = $createTextNode('x = 1');
      return {
        blocks: [
          $createParagraphNode().append(text),
          $createParagraphNode().append($createTextNode('after')),
        ],
        caret: () => text.select(0, 0),
      };
    });

    run(editor, $convertCaretBlockToCode);

    expect(blocks(editor)).toEqual(['code:x = 1', 'paragraph:after']);
  });
});
