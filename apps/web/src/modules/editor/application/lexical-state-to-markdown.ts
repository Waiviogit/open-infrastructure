import { imageBlockMarkdown } from '../domain/image-block-fields';
import { POST_IMAGE_NODE_TYPE } from '../domain/nodes/image-node';
import { POST_VIDEO_NODE_TYPE } from '../domain/nodes/video-node';

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

const MARKDOWN_FENCE = '```';
const TABLE_HEADER_ROW_STATE = 1;

type LexicalJsonNode = {
  type?: string;
  tag?: string;
  format?: number | string;
  text?: string;
  url?: string;
  src?: string;
  altText?: string;
  cid?: string;
  linkUrl?: string;
  listType?: string;
  language?: string | null;
  headerState?: number;
  children?: LexicalJsonNode[];
};

export type LexicalToMarkdownOptions = {
  resolveImageUrl: (cid: string, src: string) => string;
};

function escapeMarkdownText(text: string): string {
  return text.replace(/([\\`*_[\]#])/g, '\\$1');
}

function formatInlineText(text: string, format: number): string {
  if (!text) {
    return '';
  }
  let out = escapeMarkdownText(text);
  if (format & FORMAT_CODE) {
    out = `\`${out.replace(/`/g, '\\`')}\``;
  }
  if (format & FORMAT_STRIKETHROUGH) {
    out = `~~${out}~~`;
  }
  if (format & FORMAT_UNDERLINE) {
    out = `<u>${out}</u>`;
  }
  if (format & FORMAT_BOLD) {
    out = `**${out}**`;
  }
  if (format & FORMAT_ITALIC) {
    out = `*${out}*`;
  }
  return out;
}

function serializeChildren(
  nodes: LexicalJsonNode[] | undefined,
  options: LexicalToMarkdownOptions,
): string {
  if (!nodes?.length) {
    return '';
  }
  return nodes.map((n) => serializeNode(n, options)).join('');
}

function serializeNode(node: LexicalJsonNode, options: LexicalToMarkdownOptions): string {
  const type = node.type ?? '';
  switch (type) {
    case 'text': {
      const format =
        typeof node.format === 'number' ? node.format : Number(node.format) || 0;
      return formatInlineText(node.text ?? '', format);
    }
    case 'linebreak':
      return '\n';
    case 'link': {
      const inner = serializeChildren(node.children, options);
      const url = (node.url ?? '').trim();
      return url ? `[${inner}](${url})` : inner;
    }
    case 'paragraph':
      return serializeChildren(node.children, options);
    default:
      return serializeChildren(node.children, options);
  }
}

/** Raw text of a code block (no markdown escaping). */
function codeText(nodes: LexicalJsonNode[] | undefined): string {
  if (!nodes?.length) {
    return '';
  }
  return nodes
    .map((n) => {
      if (n.type === 'linebreak') {
        return '\n';
      }
      if (n.type === 'tab') {
        return '\t';
      }
      return n.text ?? codeText(n.children);
    })
    .join('');
}

function codeBlockMarkdown(node: LexicalJsonNode): string {
  const text = codeText(node.children);
  let fence = MARKDOWN_FENCE;
  while (text.includes(fence)) {
    fence += '`';
  }
  const language = (node.language ?? '').trim();
  return `${fence}${language}\n${text}\n${fence}\n\n`;
}

/** GFM cell: block children joined with `<br>`, pipes escaped, single line. */
function tableCellMarkdown(cell: LexicalJsonNode, options: LexicalToMarkdownOptions): string {
  const lines = (cell.children ?? [])
    .map((block) => serializeChildren(block.children, options).trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\n/g, '<br>'));
  return lines.join('<br>').replace(/\|/g, '\\|');
}

function tableMarkdown(node: LexicalJsonNode, options: LexicalToMarkdownOptions): string {
  const rows = (node.children ?? []).map((row) =>
    (row.children ?? []).map((cell) => tableCellMarkdown(cell, options)),
  );
  if (rows.length === 0) {
    return '';
  }
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (cells: string[]): string[] => [
    ...cells,
    ...Array<string>(width - cells.length).fill(''),
  ];
  const firstRowIsHeader = (node.children?.[0]?.children ?? []).some(
    (cell) => ((cell.headerState ?? 0) & TABLE_HEADER_ROW_STATE) !== 0,
  );
  const header = firstRowIsHeader ? pad(rows[0]) : Array<string>(width).fill('');
  const body = firstRowIsHeader ? rows.slice(1) : rows;
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const lines = [line(header), line(Array<string>(width).fill('---')), ...body.map((r) => line(pad(r)))];
  return `${lines.join('\n')}\n\n`;
}

function blockMarkdown(
  node: LexicalJsonNode,
  options: LexicalToMarkdownOptions,
): string {
  const type = node.type ?? '';
  const childMd = serializeChildren(node.children, options).trimEnd();

  switch (type) {
    case 'heading': {
      const parsedLevel = Number((node.tag ?? '').replace(/^h/, ''));
      const level = parsedLevel >= 1 && parsedLevel <= 6 ? parsedLevel : 2;
      const prefix = '#'.repeat(level);
      return childMd ? `${prefix} ${childMd}\n\n` : '';
    }
    case 'quote':
      return childMd
        ? childMd
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n') + '\n\n'
        : '';
    case 'spoiler':
      return childMd ? `||${childMd}||\n\n` : '';
    case POST_IMAGE_NODE_TYPE:
    case 'image': {
      const cid = typeof node.cid === 'string' ? node.cid.trim() : '';
      const src = typeof node.src === 'string' ? node.src : '';
      const url = options.resolveImageUrl(cid, src);
      if (!url) {
        return '';
      }
      return `${imageBlockMarkdown(url, node.altText ?? '', node.linkUrl ?? '')}\n\n`;
    }
    case 'list': {
      const items = node.children ?? [];
      const ordered = node.listType === 'number';
      const lines = items.map((item, index) => {
        const text = serializeChildren(item.children, options).trim();
        const marker = ordered ? `${index + 1}.` : '-';
        return `${marker} ${text}`;
      });
      return lines.length > 0 ? `${lines.join('\n')}\n\n` : '';
    }
    case 'listitem':
      return serializeChildren(node.children, options);
    case POST_VIDEO_NODE_TYPE: {
      const url = (node.url ?? '').trim();
      return url ? `${url}

` : '';
    }
    case 'horizontalrule':
      return '---\n\n';
    case 'code':
      return codeBlockMarkdown(node);
    case 'table':
      return tableMarkdown(node, options);
    case 'paragraph':
      return childMd ? `${childMd}\n\n` : '\n';
    default:
      return childMd ? `${childMd}\n\n` : '';
  }
}

const BLOCK_NODE_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'quote',
  'spoiler',
  'list',
  POST_IMAGE_NODE_TYPE,
  'image',
  POST_VIDEO_NODE_TYPE,
  'horizontalrule',
  'code',
  'table',
]);

function walkRootBlocks(
  nodes: LexicalJsonNode[] | undefined,
  options: LexicalToMarkdownOptions,
): string {
  if (!nodes?.length) {
    return '';
  }
  const parts: string[] = [];
  for (const node of nodes) {
    const type = node.type ?? '';
    if (BLOCK_NODE_TYPES.has(type)) {
      parts.push(blockMarkdown(node, options));
    } else {
      const inline = serializeChildren(node.children, options);
      if (inline.trim()) {
        parts.push(`${inline.trim()}\n\n`);
      }
    }
  }
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** Converts Lexical `editorState.toJSON()` string to Hive markdown body. */
export function lexicalStateToMarkdown(
  body: string,
  options: LexicalToMarkdownOptions,
): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }
  try {
    const state = JSON.parse(trimmed) as { root?: { children?: LexicalJsonNode[] } };
    return walkRootBlocks(state.root?.children, options);
  } catch {
    return trimmed;
  }
}
