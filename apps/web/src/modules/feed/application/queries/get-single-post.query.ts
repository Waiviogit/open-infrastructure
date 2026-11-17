import { cache } from 'react';

import { sanitizePostHtml } from '@/shared/infrastructure/sanitize-post-html';

import type { FeedStoryView } from '../dto/feed-story.dto';
import {
  mapFeedStoryItemApiToView,
  singlePostApiSchema,
} from '../mappers/feed-story-from-api.mapper';
import { fetchSinglePost } from '../../infrastructure/clients/single-post.client';

export type BlogPostPayload = {
  story: FeedStoryView;
  bodyHtmlSafe: string;
};

/** Single-post API body → story + sanitized HTML; null when the shape is unexpected. */
export function toBlogPostPayload(raw: unknown, source: string): BlogPostPayload | null {
  const parsed = singlePostApiSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${source}] unexpected response shape:`, parsed.error.flatten());
    return null;
  }
  const story = mapFeedStoryItemApiToView(parsed.data);
  const bodyHtmlSafe = sanitizePostHtml(parsed.data.body);
  return { story, bodyHtmlSafe };
}

async function getSinglePostQueryImpl(
  author: string,
  permlink: string,
  locale: string,
  viewer?: string | null,
): Promise<BlogPostPayload | null> {
  const raw = await fetchSinglePost(author, permlink, { locale, viewer });
  return raw ? toBlogPostPayload(raw, 'getSinglePostQuery') : null;
}

export const getSinglePostQuery = cache(getSinglePostQueryImpl);
