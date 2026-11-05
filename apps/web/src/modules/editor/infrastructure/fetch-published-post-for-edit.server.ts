import 'server-only';

import { z } from 'zod';

import { fetchSinglePost } from '@/modules/feed/infrastructure/clients/single-post.client';

const publishedPostSchema = z.object({
  author: z.string().min(1),
  permlink: z.string().min(1),
  title: z.string(),
  body: z.string(),
  jsonMetadata: z.string().optional().default(''),
  parentPermlink: z.string().optional().default(''),
});

export type PublishedPostForEdit = z.infer<typeof publishedPostSchema>;

/**
 * Published root post of `author` for the editor's edit mode. `null` when the
 * post is missing, is not the author's, or query-api is unavailable.
 */
export async function fetchPublishedPostForEdit(
  author: string,
  permlink: string,
): Promise<PublishedPostForEdit | null> {
  let raw: unknown;
  try {
    raw = await fetchSinglePost(author, permlink, { viewer: author });
  } catch {
    return null;
  }
  const parsed = publishedPostSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const post = parsed.data;
  if (post.author.toLowerCase() !== author.toLowerCase() || !post.parentPermlink) {
    return null;
  }
  return post;
}
