import {
  $createTableCellNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableRowNode,
  TableCellHeaderStates,
  type TableCellNode,
  type TableNode,
} from '@lexical/table';
import { $createParagraphNode } from 'lexical';

/** Insert → Table default (legacy parity): 2×2 with a header row (GFM needs one). */
export const INSERT_TABLE_DEFAULT_SIZE = '2';

function $emptyCell(headerState: number): TableCellNode {
  return $createTableCellNode(headerState).append($createParagraphNode());
}

function rowCells(table: TableNode): TableCellNode[][] {
  return table
    .getChildren()
    .filter($isTableRowNode)
    .map((row) => row.getChildren().filter($isTableCellNode));
}

/** Appends an empty row at the end (legacy "+Row"); width = widest row. Call inside `editor.update`. */
export function $appendTableRow(table: TableNode): void {
  const width = Math.max(1, ...rowCells(table).map((cells) => cells.length));
  const row = $createTableRowNode();
  for (let i = 0; i < width; i += 1) {
    row.append($emptyCell(TableCellHeaderStates.NO_STATUS));
  }
  table.append(row);
}

/**
 * Appends an empty column at the end (legacy "+Column"). The new cell in a header
 * row stays a header cell. Call inside `editor.update`.
 */
export function $appendTableColumn(table: TableNode): void {
  for (const cells of rowCells(table)) {
    const last = cells[cells.length - 1];
    const headerState =
      last && (last.getHeaderStyles() & TableCellHeaderStates.ROW) !== 0
        ? TableCellHeaderStates.ROW
        : TableCellHeaderStates.NO_STATUS;
    const row = last?.getParent();
    if ($isTableRowNode(row)) {
      row.append($emptyCell(headerState));
    }
  }
}

/** Replaces the table with an empty paragraph and puts the caret there. Call inside `editor.update`. */
export function $removeTable(table: TableNode): void {
  const paragraph = $createParagraphNode();
  table.replace(paragraph);
  paragraph.select();
}
