import {
  $convertFromMarkdownString,
  TRANSFORMERS,
  type ElementTransformer,
  type Transformer,
} from '@lexical/markdown';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  type ElementNode,
} from 'lexical';

import { extractCidFromContentGatewayUrl } from '@/config/ipfs-content-url';

import { normalizeImageLinkUrl } from '../domain/image-block-fields';
import { $createImageNode, ImageNode } from '../domain/nodes/image-node';
import { $createLineNode, $isLineNode, LineNode } from '../domain/nodes/line-node';
import { $createVideoNodeForUrl, VideoNode } from '../domain/nodes/video-node';

/** A video URL alone on a line, bare or as `[text](url)` (legacy bodies and old drafts). */
const VIDEO_LINE_REGEX = /^(?:\[[^\]]*\]\((https?:\/\/\S+?)\)|(https?:\/\/\S+))\s*$/i;
const IMAGE_LINE_REGEX = /^!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/;
/** `[![alt](src)](href)` alone on a line: an image that links somewhere. */
const LINKED_IMAGE_LINE_REGEX =
  /^\[!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/;
const BARE_IMAGE_URL_REGEX = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:\?\S*)?)\s*$/i;
const HORIZONTAL_RULE_REGEX = /^(?:---|\*\*\*|___)\s*$/;
const TABLE_ROW_REGEX = /^\|(.+)\|\s*$/;
const TABLE_DIVIDER_CELL_REGEX = /^\s*:?-{3,}:?\s*$/;
const CELL_LINE_BREAK_REGEX = /<br\s*\/?>/i;

function imageNodeForUrl(url: string, altText: string, linkUrl = '') {
  const cid = extractCidFromContentGatewayUrl(url);
  return $createImageNode({ src: url, altText, linkUrl, ...(cid ? { cid } : {}) });
}

const VIDEO_LINE: ElementTransformer = {
  dependencies: [VideoNode],
  export: () => null,
  regExp: VIDEO_LINE_REGEX,
  replace: (parentNode, _children, match) => {
    const video = $createVideoNodeForUrl(match[1] ?? match[2] ?? '');
    if (!video) {
      return false;
    }
    parentNode.replace(video);
    return true;
  },
  type: 'element',
};

const IMAGE_LINE: ElementTransformer = {
  dependencies: [ImageNode],
  export: () => null,
  regExp: IMAGE_LINE_REGEX,
  replace: (parentNode, _children, match) => {
    parentNode.replace(imageNodeForUrl(match[2] ?? '', match[1] ?? ''));
    return true;
  },
  type: 'element',
};

/** Unsafe or invalid hrefs keep the image and drop the link. */
const LINKED_IMAGE_LINE: ElementTransformer = {
  dependencies: [ImageNode],
  export: () => null,
  regExp: LINKED_IMAGE_LINE_REGEX,
  replace: (parentNode, _children, match) => {
    const linkUrl = normalizeImageLinkUrl(match[3] ?? '') ?? '';
    parentNode.replace(imageNodeForUrl(match[2] ?? '', match[1] ?? '', linkUrl));
    return true;
  },
  type: 'element',
};

/** Hive bodies often carry a bare image URL on its own line. */
const BARE_IMAGE_URL: ElementTransformer = {
  dependencies: [ImageNode],
  export: () => null,
  regExp: BARE_IMAGE_URL_REGEX,
  replace: (parentNode, _children, match) => {
    parentNode.replace(imageNodeForUrl(match[1] ?? '', ''));
  },
  type: 'element',
};

const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [LineNode],
  export: (node) => ($isLineNode(node) ? '---' : null),
  regExp: HORIZONTAL_RULE_REGEX,
  replace: (parentNode) => {
    parentNode.replace($createLineNode());
  },
  type: 'element',
};

/** Splits `a | b \| c` on unescaped pipes and unescapes `\|`. */
export function splitMarkdownTableRow(inner: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function tableCell(text: string, header: boolean) {
  const cell = $createTableCellNode(
    header ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS,
  );
  const paragraph = $createParagraphNode();
  text.split(CELL_LINE_BREAK_REGEX).forEach((line, index) => {
    if (index > 0) {
      paragraph.append($createLineBreakNode());
    }
    if (line) {
      paragraph.append($createTextNode(line));
    }
  });
  cell.append(paragraph);
  return cell;
}

/**
 * GFM table, one line at a time: consecutive rows join the table above; the
 * `| --- |` divider turns the first row into the header row.
 */
const TABLE_ROW: ElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: () => null,
  regExp: TABLE_ROW_REGEX,
  replace: (parentNode: ElementNode, _children, match) => {
    const cells = splitMarkdownTableRow(match[1] ?? '');
    const previous = parentNode.getPreviousSibling();
    const table = $isTableNode(previous) ? previous : null;

    if (cells.every((c) => TABLE_DIVIDER_CELL_REGEX.test(c))) {
      const firstRow = table?.getFirstChild();
      if (table && $isTableRowNode(firstRow) && table.getChildrenSize() === 1) {
        for (const cell of firstRow.getChildren()) {
          (cell as TableCellNode).setHeaderStyles(TableCellHeaderStates.ROW);
        }
      }
      parentNode.remove();
      return;
    }

    const row = $createTableRowNode();
    cells.forEach((text) => row.append(tableCell(text, false)));
    if (table) {
      table.append(row);
      parentNode.remove();
      return;
    }
    const newTable = $createTableNode();
    newTable.append(row);
    parentNode.replace(newTable);
  },
  type: 'element',
};

export const POST_MARKDOWN_TRANSFORMERS: Transformer[] = [
  VIDEO_LINE,
  LINKED_IMAGE_LINE,
  IMAGE_LINE,
  BARE_IMAGE_URL,
  HORIZONTAL_RULE,
  TABLE_ROW,
  ...TRANSFORMERS,
];

/**
 * Replaces the root content with nodes parsed from a published Hive markdown
 * body (headings, lists, quotes, code, links, images, rules, tables). Raw HTML
 * stays as text. Call inside `editor.update`.
 */
export function $importPostMarkdown(markdown: string): void {
  $convertFromMarkdownString(markdown, POST_MARKDOWN_TRANSFORMERS, undefined, false, false);
}
