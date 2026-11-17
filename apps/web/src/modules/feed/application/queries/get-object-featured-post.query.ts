import { cache } from 'react';

import { fetchObjectFeaturedPost } from '../../infrastructure/clients/object-featured-post.client';
import { toBlogPostPayload, type BlogPostPayload } from './get-single-post.query';

/** The object's featured post in full (top pin, else newest post), or null when it has no posts. */
async function getObjectFeaturedPostQueryImpl(
  objectId: string,
  locale: string,
  viewer?: string | null,
): Promise<BlogPostPayload | null> {
  const raw = await fetchObjectFeaturedPost(objectId, { locale, viewer });
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const post = (raw as { post?: unknown }).post;
  return post == null ? null : toBlogPostPayload(post, 'getObjectFeaturedPostQuery');
}

export const getObjectFeaturedPostQuery = cache(getObjectFeaturedPostQueryImpl);
