import { Injectable } from '@nestjs/common';
import type { SupportedCurrency } from '@opden-data-layer/core';
import type { ObjectFeaturedPostResponse } from './feed-story-dtos';
import { GetObjectPostsFeedEndpoint } from './get-object-posts-feed.endpoint';
import { GetPostByKeyEndpoint } from './get-post-by-key.endpoint';

/**
 * Featured post of an object: the first post of its Posts feed for an anonymous viewer — the top
 * pin, else the newest post — returned in full (single-post shape).
 * @see docs/apps/query-api/spec/object-featured-post.md
 */
@Injectable()
export class GetObjectFeaturedPostEndpoint {
  constructor(
    private readonly getObjectPostsFeed: GetObjectPostsFeedEndpoint,
    private readonly getPostByKey: GetPostByKeyEndpoint,
  ) {}

  /** Null when the object does not exist; `{ post: null }` when it has no posts. */
  async execute(params: {
    objectId: string;
    locale: string;
    governanceObjectIdFromHeader?: string;
    viewerAccount?: string;
    currency: SupportedCurrency;
    countryCode: string | null;
  }): Promise<ObjectFeaturedPostResponse | null> {
    const found = await this.getObjectPostsFeed.findFirstPost(
      params.objectId,
      params.locale,
      params.governanceObjectIdFromHeader,
    );
    if (!found) {
      return null;
    }
    if (!found.first) {
      return { post: null, source: null };
    }

    const post = await this.getPostByKey.execute(
      found.first.author,
      found.first.permlink,
      params.locale,
      params.governanceObjectIdFromHeader,
      params.viewerAccount,
      params.currency,
      params.countryCode,
    );
    return post ? { post, source: found.first.source } : { post: null, source: null };
  }
}
