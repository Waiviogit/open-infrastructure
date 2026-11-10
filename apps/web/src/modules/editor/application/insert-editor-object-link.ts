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

import { HASH_TRIGGER } from './hash-object-search';
import { POST_EDITOR_HASHTAG_OBJECT_TYPE } from './post-editor-advanced-settings';

export function buildObjectLinkHref(objectId: string): string {
  const path = objectPagePath(objectId);
  if (typeof window === 'undefined') {
    return path;
  }
  return `${window.location.origin}${path}`;
}

/**
 * Visible text of an inserted object link: the object name, or its id. A hashtag object keeps
 * its `#` (`india` → `#india`), even though the `#` typed to open the search is replaced.
 */
export function objectLinkDisplayLabel(result: SearchObjectResult): string {
  const label = result.name?.trim() || result.object_id;
  const isHashtag = result.object_type.toLowerCase() === POST_EDITOR_HASHTAG_OBJECT_TYPE;
  if (!isHashtag || label.startsWith(HASH_TRIGGER)) {
    return label;
  }
  return `${HASH_TRIGGER}${label}`;
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
