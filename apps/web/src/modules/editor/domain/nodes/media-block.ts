import type { LexicalNode } from 'lexical';

import { $isImageNode, type ImageNode } from './image-node';
import { $isLineNode, type LineNode } from './line-node';
import { $isVideoNode, type VideoNode } from './video-node';

/**
 * Non-text blocks in the post body (image, video, horizontal rule): Backspace /
 * Delete next to one selects it first, a second press removes it.
 */
export type MediaBlockNode = ImageNode | VideoNode | LineNode;

export function $isMediaBlockNode(node: LexicalNode | null | undefined): node is MediaBlockNode {
  return $isImageNode(node) || $isVideoNode(node) || $isLineNode(node);
}
