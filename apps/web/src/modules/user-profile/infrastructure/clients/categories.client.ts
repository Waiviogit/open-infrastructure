import 'server-only';

import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import { categoryNavDataSchema, type CategoryNavData } from '../../domain/types/category-nav';
import { queryApiFetch } from './query-api.client';

export type GetCategoryNavOptions = {
  /** Parent category (drill-down); matches `apiNavContextFromLineage`. */
  parentName?: string;
  /** Ancestors before `name`. */
  path?: readonly string[];
};

function buildCategoriesSearchParams(objectType: string, options?: GetCategoryNavOptions): string {
  const sp = new URLSearchParams();
  sp.append('types', objectType.trim());
  const parent = options?.parentName?.trim();
  if (parent && parent.length > 0) {
    sp.set('name', parent);
  }
  for (const segment of options?.path ?? []) {
    if (segment.trim().length > 0) {
      sp.append('path', segment);
    }
  }
  return `?${sp.toString()}`;
}

/**
 * Category tree slice of one category object type in the user's Favorites scope.
 * Tagged with `userFavorites` so a favorite toggle refreshes the counts.
 */
export async function getCategoryNav(
  username: string,
  objectType: string,
  options?: GetCategoryNavOptions,
): Promise<CategoryNavData | null> {
  const name = username.trim();
  if (name.length === 0 || objectType.trim().length === 0) {
    return null;
  }
  const qs = buildCategoriesSearchParams(objectType, options);
  const path = `/query/v1/users/${encodeURIComponent(name)}/categories${qs}`;
  const raw = await queryApiFetch<unknown>(path, {
    cacheTags: [queryApiCacheTags.userFavorites(name)],
  });
  if (raw == null) {
    return null;
  }
  const parsed = categoryNavDataSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[getCategoryNav] unexpected response', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}
