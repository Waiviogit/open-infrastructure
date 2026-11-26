import 'server-only';

import { projectedObjectViewSchema } from '@/modules/feed/application/dto/feed-story.dto';
import { queryApiFetch } from '@/modules/user-profile/infrastructure/clients/query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import type { ObjectHeroIdentity } from '../domain/object-page.types';
import { projectedObjectToHeroIdentity } from './projected-object-to-page-model';

/**
 * Hero fields of an object page from query-api `GET /objects/:id/head`.
 * Viewer-independent on purpose: no `X-Viewer`, no client IP — one cache entry per object and
 * locale, shared by every visitor and usable in a link prefetch. `null` on any failure.
 */
export async function fetchObjectHead(
  objectId: string,
  init: { locale: string },
): Promise<ObjectHeroIdentity | null> {
  const raw = await queryApiFetch<unknown>(
    `/query/v1/objects/${encodeURIComponent(objectId)}/head`,
    {
      headers: {
        Accept: 'application/json',
        'X-Locale': init.locale,
        'Accept-Language': init.locale,
      },
      cacheTags: [queryApiCacheTags.objectHead(objectId)],
    },
  );
  if (raw == null) {
    return null;
  }
  const parsed = projectedObjectViewSchema.safeParse(raw);
  return parsed.success ? projectedObjectToHeroIdentity(parsed.data) : null;
}
