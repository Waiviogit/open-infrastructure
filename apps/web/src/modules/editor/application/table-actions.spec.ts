import {
  $createTableNodeWithDimensions,
  $isTableNode,
  type TableNode,
} from '@lexical/table';
import { $createParagraphNode, $createTextNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';
import {
  $appendTableColumn,
  $appendTableRow,
  $removeTable,
  INSERT_TABLE_DEFAULT_SIZE,
} from './table-actions';

function editorWithTable(): LexicalEditor {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  const size = Number(INSERT_TABLE_DEFAULT_SIZE);
  editor.update(
    () => {
      $getRoot().append(
        $createParagraphNode().append($createTextNode('before')),
        $createTableNodeWithDimensions(size, size, { rows: true, columns: false }),
      );
    },
    { discrete: true },
  );
  return editor;
}

function withTable(editor: LexicalEditor, fn: (table: TableNode) => void): void {
  editor.update(
    () => {
      const table = $getRoot().getChildren().find($isTableNode);
      if (!table) {
        throw new Error('no table');
      }
      fn(table);
    },
    { discrete: true },
  );
}

function markdown(editor: LexicalEditor): string {
  return lexicalStateToMarkdown(JSON.stringify(editor.getEditorState().toJSON()), {
    resolveImageUrl: (_cid, src) => src,
  });
}

describe('table toolbar actions', () => {
  it('inserts a 2×2 table by default', () => {
    expect(markdown(editorWithTable())).toBe('before\n\n|  |  |\n| --- | --- |\n|  |  |');
  });

  it('+Row appends an empty body row at the end', () => {
    const editor = editorWithTable();
    withTable(editor, $appendTableRow);

    expect(markdown(editor)).toBe('before\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |');
  });

  it('+Column appends a column to every row and keeps the header row', () => {
    const editor = editorWithTable();
    withTable(editor, $appendTableColumn);

    expect(markdown(editor)).toBe('before\n\n|  |  |  |\n| --- | --- | --- |\n|  |  |  |');
    const headerCells = editor.getEditorState().read(() => {
      const table = $getRoot().getChildren().find($isTableNode);
      const firstRow = table?.getFirstChild() as unknown as { getChildren: () => { getHeaderStyles: () => number }[] };
      return firstRow.getChildren().map((c) => c.getHeaderStyles());
    });
    expect(headerCells).toEqual([1, 1, 1]);
  });

  it('Remove table leaves an empty paragraph in its place', () => {
    const editor = editorWithTable();
    withTable(editor, $removeTable);

    const types = editor.getEditorState().read(() => $getRoot().getChildren().map((n) => n.getType()));
    expect(types).toEqual(['paragraph', 'paragraph']);
    expect(markdown(editor)).toBe('before');
  });
});
