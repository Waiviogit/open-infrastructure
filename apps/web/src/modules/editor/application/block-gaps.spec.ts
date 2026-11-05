import { $createCodeNode } from '@lexical/code';
import { $createTableNodeWithDimensions } from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  createEditor,
  RootNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { $createImageNode } from '../domain/nodes/image-node';
import { $createLineNode } from '../domain/nodes/line-node';
import { $createVideoNode } from '../domain/nodes/video-node';
import { $ensureTrailingTextLine, $leaveBlockAtEdge, type BlockSide } from './block-gaps';

const BLOCKS: Record<string, () => LexicalNode> = {
  image: () => $createImageNode({ src: 'https://img.example/a.png' }),
  video: () => $createVideoNode('https://www.youtube.com/watch?v=vJgM9oF7siA'),
  line: () => $createLineNode(),
  code: () => $createCodeNode().append($createTextNode('x = 1')),
  table: () => $createTableNodeWithDimensions(2, 2, { rows: true, columns: false }),
};

const paragraph = (text: string) => $createParagraphNode().append($createTextNode(text));

function editorWith(build: () => LexicalNode[], withTransform = false): LexicalEditor {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  if (withTransform) {
    editor.registerNodeTransform(RootNode, $ensureTrailingTextLine);
  }
  editor.update(() => $getRoot().clear().append(...build()), { discrete: true });
  return editor;
}

function types(editor: LexicalEditor): string[] {
  return editor.getEditorState().read(() => $getRoot().getChildren().map((n) => n.getType()));
}

/** Where the caret / selection is after the move: `range #i` or `selected #i`. */
function selectionAt(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => {
    const s = $getSelection();
    if ($isNodeSelection(s)) {
      return `selected #${s.getNodes()[0]?.getIndexWithinParent()}`;
    }
    if ($isRangeSelection(s)) {
      return `range #${s.anchor.getNode().getTopLevelElementOrThrow().getIndexWithinParent()}`;
    }
    return 'none';
  });
}

function leave(editor: LexicalEditor, index: number, side: BlockSide): boolean {
  let handled = false;
  editor.update(
    () => {
      handled = $leaveBlockAtEdge($getRoot().getChildAtIndex(index) as LexicalNode, side);
    },
    { discrete: true },
  );
  return handled;
}

describe('document always ends with a text line', () => {
  it.each(Object.keys(BLOCKS))('adds an empty paragraph after a %s that ends the document', (kind) => {
    expect(types(editorWith(() => [paragraph('a'), BLOCKS[kind]()], true)).at(-1)).toBe('paragraph');
  });

  it('re-adds the line when the user deletes the paragraph after the last table', () => {
    const editor = editorWith(() => [paragraph('a'), BLOCKS.table()], true);
    editor.update(() => $getRoot().getLastChildOrThrow().remove(), { discrete: true });

    expect(types(editor)).toEqual(['paragraph', 'table', 'paragraph']);
  });

  it('leaves a document that ends with text untouched', () => {
    expect(types(editorWith(() => [BLOCKS.table(), paragraph('end')], true))).toEqual(['table', 'paragraph']);
  });
});

describe('horizontal line compatibility', () => {
  it('loads a line saved by Lexical HorizontalRuleNode (no element fields)', () => {
    const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
    const json = JSON.stringify({
      root: {
        type: 'root', version: 1, direction: null, format: '', indent: 0,
        children: [{ type: 'horizontalrule', version: 1 }],
      },
    });
    editor.setEditorState(editor.parseEditorState(json));

    expect(types(editor)).toEqual(['horizontalrule']);
  });
});

describe('arrow keys around blocks', () => {
  it.each(['image', 'video', 'line'])('ArrowUp from a text line selects the %s above it', (kind) => {
    const editor = editorWith(() => [BLOCKS[kind](), paragraph('below')]);

    expect(leave(editor, 1, 'before')).toBe(true);
    expect(selectionAt(editor)).toBe('selected #0');
  });

  it.each(['image', 'video', 'line'])('ArrowUp from a selected %s at the top opens a line above it', (kind) => {
    const editor = editorWith(() => [BLOCKS[kind](), paragraph('below')]);

    leave(editor, 0, 'before');

    expect(types(editor)[0]).toBe('paragraph');
    expect(selectionAt(editor)).toBe('range #0');
  });

  it.each(['image', 'video', 'line'])('ArrowDown from a selected %s selects the same block below it', (kind) => {
    const editor = editorWith(() => [paragraph('above'), BLOCKS[kind](), BLOCKS[kind](), paragraph('end')]);

    leave(editor, 1, 'after');

    expect(selectionAt(editor)).toBe('selected #2');
  });

  it('ArrowDown from a selected image puts the caret at the start of the text below', () => {
    const editor = editorWith(() => [BLOCKS.image(), paragraph('below')]);

    leave(editor, 0, 'after');

    expect(selectionAt(editor)).toBe('range #1');
  });

  it.each(['code', 'table'])('ArrowUp out of a %s at the start of the document opens a line above', (kind) => {
    const editor = editorWith(() => [BLOCKS[kind](), paragraph('below')]);

    expect(leave(editor, 0, 'before')).toBe(true);
    expect(types(editor)).toEqual(['paragraph', kind, 'paragraph']);
    expect(selectionAt(editor)).toBe('range #0');
  });

  it.each(['code', 'table'])('ArrowDown between two %s blocks opens a line between them', (kind) => {
    const editor = editorWith(() => [BLOCKS[kind](), BLOCKS[kind](), paragraph('end')]);

    leave(editor, 0, 'after');

    expect(types(editor)).toEqual([kind, 'paragraph', kind, 'paragraph']);
    expect(selectionAt(editor)).toBe('range #1');
  });

  it('keeps the default move when a text line is next to a table', () => {
    const editor = editorWith(() => [paragraph('before'), BLOCKS.table()]);

    expect(leave(editor, 1, 'before')).toBe(false);
    expect(types(editor)).toEqual(['paragraph', 'table']);
  });

  it('keeps the default move from a text line into a code block', () => {
    const editor = editorWith(() => [paragraph('text'), BLOCKS.code()]);

    expect(leave(editor, 0, 'after')).toBe(false);
  });
});
