import { $createLinkNode, type LinkNode } from '@lexical/link';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { objectPagePath } from '@/shared/routes/object-page-path';
import {
  $createTextNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';

export function buildObjectLinkHref(objectId: string): string {
  const path = objectPagePath(objectId);
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.origin}${path}`;
}

export function objectLinkDisplayLabel(result: SearchObjectResult): string {
  return result.name?.trim() || result.object_id;
}

/** Object link node (visible name, href on current host). Call inside `editor.update`. */
export function $createObjectLinkNode(result: SearchObjectResult): LinkNode {
  const linkNode = $createLinkNode(buildObjectLinkHref(result.object_id));
  linkNode.append($createTextNode(objectLinkDisplayLabel(result)));
  return linkNode;
}

/** Inserts a styled object link at the current selection (visible name, href on current host). */
export function insertObjectLinkAtSelection(
  editor: LexicalEditor,
  result: SearchObjectResult,
): void {
  editor.update(() => {
    const linkNode = $createObjectLinkNode(result);

    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.insertNodes([linkNode]);
      return;
    }
    $insertNodes([linkNode]);
  });
}
