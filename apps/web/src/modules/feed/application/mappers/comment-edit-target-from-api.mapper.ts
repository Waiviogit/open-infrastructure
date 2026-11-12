import { z } from 'zod';

import { fail, ok, type Result } from '@/shared/domain/result';

import type { CommentEditTarget } from '../../domain/comment-edit-target';

/** Fields of the query-api single-post read that an inline comment edit needs. */
const commentEditSourceSchema = z.object({
  author: z.string().min(1),
  permlink: z.string().min(1),
  parentAuthor: z.string().optional().default(''),
  parentPermlink: z.string().optional().default(''),
  title: z.string().optional().default(''),
  body: z.string(),
  jsonMetadata: z.string().optional().default(''),
});

export type CommentEditTargetError = 'not_found' | 'not_a_reply' | 'not_author';

/**
 * Edit target from a single-post read. Only the author's own comments and threads qualify:
 * a root post (empty `parentAuthor`) is edited in `/editor`.
 */
export function mapSinglePostToCommentEditTarget(
  raw: unknown,
  viewer: string,
): Result<CommentEditTarget, CommentEditTargetError> {
  const parsed = commentEditSourceSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('not_found');
  }
  const post = parsed.data;
  if (post.author.trim().toLowerCase() !== viewer.trim().toLowerCase()) {
    return fail('not_author');
  }
  if (post.parentAuthor.trim() === '' || post.parentPermlink.trim() === '') {
    return fail('not_a_reply');
  }
  return ok({
    author: post.author,
    permlink: post.permlink,
    parentAuthor: post.parentAuthor,
    parentPermlink: post.parentPermlink,
    title: post.title,
    body: post.body,
    jsonMetadata: post.jsonMetadata,
  });
}
