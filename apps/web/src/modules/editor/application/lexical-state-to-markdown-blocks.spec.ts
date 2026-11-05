import { $createCodeNode } from '@lexical/code';
import { $createTableNodeWithDimensions, $isTableCellNode } from '@lexical/table';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalNode,
} from 'lexical';

import { POST_EDITOR_NODES } from '../domain/editor-lexical-nodes';
import { $createLineNode } from '../domain/nodes/line-node';
import { lexicalStateToMarkdown } from './lexical-state-to-markdown';

const resolveImageUrl = (cid: string, src: string) => (cid ? `https://ipfs.example/${cid}` : src);

/** Real Lexical JSON for the given root children (same shape the editor saves). */
function markdownOf(build: () => LexicalNode[]): string {
  const editor = createEditor({ nodes: [...POST_EDITOR_NODES], onError: (e) => { throw e; } });
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      root.append(...build());
    },
    { discrete: true },
  );
  return lexicalStateToMarkdown(JSON.stringify(editor.getEditorState().toJSON()), {
    resolveImageUrl,
  });
}

function paragraph(text: string) {
  return $createParagraphNode().append($createTextNode(text));
}

function setCellText(table: LexicalNode, rows: string[][]): void {
  const tableRows = (table as unknown as { getChildren: () => LexicalNode[] }).getChildren();
  rows.forEach((cells, r) => {
    const rowCells = (tableRows[r] as unknown as { getChildren: () => LexicalNode[] }).getChildren();
    cells.forEach((text, c) => {
      const cell = rowCells[c];
      if ($isTableCellNode(cell)) {
        cell.clear();
        const lines = text.split('\n');
        const p = $createParagraphNode();
        lines.forEach((line, i) => {
          if (i > 0) {
            p.append($createLineBreakNode());
          }
          p.append($createTextNode(line));
        });
        cell.append(p);
      }
    });
  });
}

describe('lexicalStateToMarkdown block nodes', () => {
  it('publishes a horizontal rule as ---', () => {
    expect(markdownOf(() => [paragraph('a'), $createLineNode(), paragraph('b')])).toBe(
      'a\n\n---\n\nb',
    );
  });

  it('publishes a code block fenced with its language and unescaped text', () => {
    expect(
      markdownOf(() => [
        $createCodeNode('js').append(
          $createTextNode('const x = a*b;'),
          $createLineBreakNode(),
          $createTextNode('[x]'),
        ),
      ]),
    ).toBe('```js\nconst x = a*b;\n[x]\n```');
  });

  it('uses a longer fence when the code contains ```', () => {
    expect(markdownOf(() => [$createCodeNode().append($createTextNode('```'))])).toBe(
      '````\n```\n````',
    );
  });

  it('publishes a table as GFM with a header row and escaped pipes', () => {
    expect(
      markdownOf(() => {
        const table = $createTableNodeWithDimensions(2, 2, { rows: true, columns: false });
        setCellText(table, [
          ['h1', 'h2'],
          ['a|b', 'c'],
        ]);
        return [table];
      }),
    ).toBe('| h1 | h2 |\n| --- | --- |\n| a\\|b | c |');
  });

  it('keeps a multi-line cell on one table row using <br>', () => {
    expect(
      markdownOf(() => {
        const table = $createTableNodeWithDimensions(2, 1, { rows: true, columns: false });
        setCellText(table, [['head'], ['line 1\nline 2']]);
        return [table];
      }),
    ).toBe('| head |\n| --- |\n| line 1<br>line 2 |');
  });

  it('adds an empty header when the table has no header row', () => {
    expect(
      markdownOf(() => {
        const table = $createTableNodeWithDimensions(1, 2, false);
        setCellText(table, [['a', 'b']]);
        return [table];
      }),
    ).toBe('|  |  |\n| --- | --- |\n| a | b |');
  });
});
