import 'server-only';

import type { FavoritesTypesResponse } from '../../domain/types/favorites';
import { favoritesTypesResponseSchema } from '../../domain/types/favorites';
import { queryApiFetch } from './query-api.client';
import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

/** Object types in the user's Favorites scope (`types` + counted `items`). */
export async function fetchFavoritesTypes(
  username: string,
): Promise<FavoritesTypesResponse | null> {
  const name = username.trim();
  if (name.length === 0) {
    return null;
  }
  const path = `/query/v1/users/${encodeURIComponent(name)}/favorites/types`;
  const raw = await queryApiFetch<unknown>(path, {
    cacheTags: [queryApiCacheTags.userFavoritesTypes(name)],
  });
  if (raw == null) {
    return null;
  }
  const parsed = favoritesTypesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[fetchFavoritesTypes] unexpected response', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}
