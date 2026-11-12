import { THREAD_ACCOUNTS } from '@opden-data-layer/core';
import {
  buildCommentOp,
  type CommentOp,
} from '@opden-data-layer/hive-broadcast';

import { mergeEditedPostJsonMetadata } from '@/modules/editor/application/post-publish-operations';
import {
  appendObjectAnchorToThreadBody,
  extractTrailingObjectAnchorId,
} from '@/modules/object/domain/append-object-anchor-to-thread-body';

import type { CommentEditTarget } from '../domain/comment-edit-target';

const MARKDOWN_FORMAT = 'markdown';

export type BuildCommentEditOpInput = {
  target: CommentEditTarget;
  /** Edited body, already serialized with `editorBodyToMarkdown`. */
  body: string;
  /** `json_metadata.app` of this client. */
  app: string;
};

function isThreadParent(parentAuthor: string): boolean {
  const parent = parentAuthor.trim().toLowerCase();
  return THREAD_ACCOUNTS.some((account) => account === parent);
}

/**
 * Thread bodies keep the object anchor the compose bar appended, so an edit never drops the
 * thread from the object's feed. The append is idempotent: an anchor still in the body stays single.
 */
function bodyWithThreadAnchor(target: CommentEditTarget, body: string): string {
  if (!isThreadParent(target.parentAuthor)) {
    return body.trim();
  }
  const anchorId = extractTrailingObjectAnchorId(target.body);
  return anchorId
    ? appendObjectAnchorToThreadBody(body, anchorId)
    : body.trim();
}

/**
 * `comment` op for an edit of a published comment or thread: same author, permlink and parent,
 * the published title, and the published `json_metadata` with this client's `app` and `format`.
 */
export function buildCommentEditOp({
  target,
  body,
  app,
}: BuildCommentEditOpInput): CommentOp {
  const jsonMetadata = mergeEditedPostJsonMetadata(target.jsonMetadata, {
    app,
    format: MARKDOWN_FORMAT,
  });
  return buildCommentOp({
    parent_author: target.parentAuthor,
    parent_permlink: target.parentPermlink,
    author: target.author,
    permlink: target.permlink,
    title: target.title,
    body: bodyWithThreadAnchor(target, body),
    json_metadata: JSON.stringify(jsonMetadata),
  });
}
