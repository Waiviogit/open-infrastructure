import 'server-only';

import { z } from 'zod';

import { fetchSinglePost } from '@/modules/feed/infrastructure/clients/single-post.client';
import { fail, ok, type Result } from '@/shared/domain/result';

const publishedPostSchema = z.object({
  author: z.string().min(1),
  permlink: z.string().min(1),
  title: z.string(),
  body: z.string(),
  jsonMetadata: z.string().optional().default(''),
  parentAuthor: z.string().optional().default(''),
  parentPermlink: z.string().optional().default(''),
});

export type PublishedPostForEdit = z.infer<typeof publishedPostSchema>;

/**
 * `not_found`: missing, not the author's, or query-api unavailable.
 * `not_a_post`: a comment or thread (non-empty parent author) — edited inline where it is posted.
 */
export type PublishedPostForEditError = 'not_found' | 'not_a_post';

/** Published root post of `author` for the editor's edit mode. Never throws. */
export async function fetchPublishedPostForEdit(
  author: string,
  permlink: string,
): Promise<Result<PublishedPostForEdit, PublishedPostForEditError>> {
  let raw: unknown;
  try {
    raw = await fetchSinglePost(author, permlink, { viewer: author });
  } catch {
    return fail('not_found');
  }
  const parsed = publishedPostSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('not_found');
  }
  const post = parsed.data;
  if (post.author.toLowerCase() !== author.toLowerCase()) {
    return fail('not_found');
  }
  if (post.parentAuthor.trim() !== '') {
    return fail('not_a_post');
  }
  if (!post.parentPermlink) {
    return fail('not_found');
  }
  return ok(post);
}
