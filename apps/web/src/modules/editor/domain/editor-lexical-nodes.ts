import { CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { LineBreakNode, ParagraphNode, TextNode } from 'lexical';

import { ImageNode } from './nodes/image-node';
import { LineNode } from './nodes/line-node';
import { SpoilerNode } from './nodes/spoiler-node';
import { VideoNode } from './nodes/video-node';

/** Stable node list — must not be recreated per render (Lexical registry identity). */
export const POST_EDITOR_NODES = [
  ParagraphNode,
  TextNode,
  LineBreakNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  SpoilerNode,
  ImageNode,
  VideoNode,
  LineNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
] as const;

export { ImageNode, SpoilerNode, VideoNode };
export {
  $createImageNode,
  $isImageNode,
  INSERT_IMAGE_COMMAND,
  type ImagePayload,
} from './nodes/image-node';
