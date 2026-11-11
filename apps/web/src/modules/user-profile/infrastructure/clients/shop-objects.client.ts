import 'server-only';

import { queryApiCacheTags } from '@/shared/infrastructure/query/query-api-cache-tags';

import type { ShopObjectsPage, ShopSectionsPage } from '../../domain/types/shop-objects';
import { shopObjectsPageSchema, shopSectionsPageSchema } from '../../domain/types/shop-objects';
import { queryApiFetch } from './query-api.client';

/** Filters shared by the Favorites list and section endpoints. */
type FavoritesListFilterParams = {
  tags?: readonly string[];
  rating?: number | null;
};

export type FetchShopObjectsParams = FavoritesListFilterParams & {
  /** One Favorites object type (query-api `types`, exactly one value). */
  objectType: string;
  categoryPath: readonly string[];
  /** When true, only objects with no category tags (query-api `uncategorizedOnly`). */
  uncategorizedOnly?: boolean;
  limit?: number;
  cursor?: string | null;
};

export type FetchShopSectionsParams = FavoritesListFilterParams & {
  /** One category object type (query-api `types`, exactly one value). */
  objectType: string;
  /** Parent department (drill-down); omit at root. */
  name?: string;
  /** Ancestors before `name`. */
  path?: readonly string[];
  cursor?: string | null;
  sectionLimit?: number;
};

function appendFilterParams(sp: URLSearchParams, params: FavoritesListFilterParams): void {
  for (const tag of params.tags ?? []) {
    const trimmed = tag.trim();
    if (trimmed) {
      sp.append('tags', trimmed);
    }
  }
  if (params.rating != null) {
    sp.set('rating', String(params.rating));
  }
}

function appendNonEmpty(sp: URLSearchParams, key: string, values: readonly string[]): void {
  for (const value of values) {
    if (value.trim().length > 0) {
      sp.append(key, value);
    }
  }
}

function appendCursor(sp: URLSearchParams, cursor: string | null | undefined): void {
  const trimmed = cursor?.trim();
  if (trimmed) {
    sp.set('cursor', trimmed);
  }
}

function buildShopObjectsSearchParams(params: FetchShopObjectsParams): string {
  const sp = new URLSearchParams();
  sp.append('types', params.objectType.trim());
  appendNonEmpty(sp, 'categoryPath', params.categoryPath);
  if (params.uncategorizedOnly === true) {
    sp.set('uncategorizedOnly', 'true');
  }
  appendFilterParams(sp, params);
  if (params.limit != null) {
    sp.set('limit', String(params.limit));
  }
  appendCursor(sp, params.cursor);
  return `?${sp.toString()}`;
}

function buildShopSectionsSearchParams(params: FetchShopSectionsParams): string {
  const sp = new URLSearchParams();
  sp.append('types', params.objectType.trim());
  const parent = params.name?.trim();
  if (parent && parent.length > 0) {
    sp.set('name', parent);
  }
  appendNonEmpty(sp, 'path', params.path ?? []);
  appendFilterParams(sp, params);
  if (params.sectionLimit != null) {
    sp.set('sectionLimit', String(params.sectionLimit));
  }
  appendCursor(sp, params.cursor);
  return `?${sp.toString()}`;
}

function viewerHeaders(viewer?: string | null): Record<string, string> | undefined {
  const v = viewer?.trim();
  if (!v) {
    return undefined;
  }
  return { 'X-Viewer': v };
}

/** Favorites objects of one type (weight order, opaque cursor). */
export async function fetchShopObjects(
  username: string,
  params: FetchShopObjectsParams,
  init?: { viewer?: string | null },
): Promise<ShopObjectsPage | null> {
  const name = username.trim();
  if (name.length === 0 || params.objectType.trim().length === 0) {
    return null;
  }
  const qs = buildShopObjectsSearchParams(params);
  const path = `/query/v1/users/${encodeURIComponent(name)}/shop-objects${qs}`;
  const headers = viewerHeaders(init?.viewer ?? null);
  const raw = await queryApiFetch<unknown>(path, {
    ...(headers ? { headers } : {}),
    cacheTags: [queryApiCacheTags.userFavorites(name)],
    forwardClientIp: true,
  });
  if (raw == null) {
    return null;
  }
  const parsed = shopObjectsPageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[fetchShopObjects] unexpected response', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

/** Child categories of one category type with preview objects. */
export async function fetchShopSections(
  username: string,
  params: FetchShopSectionsParams,
  init?: { viewer?: string | null },
): Promise<ShopSectionsPage | null> {
  const name = username.trim();
  if (name.length === 0 || params.objectType.trim().length === 0) {
    return null;
  }
  const qs = buildShopSectionsSearchParams(params);
  const path = `/query/v1/users/${encodeURIComponent(name)}/shop-sections${qs}`;
  const headers = viewerHeaders(init?.viewer ?? null);
  const raw = await queryApiFetch<unknown>(path, {
    ...(headers ? { headers } : {}),
    cacheTags: [queryApiCacheTags.userFavorites(name)],
    forwardClientIp: true,
  });
  if (raw == null) {
    return null;
  }
  const parsed = shopSectionsPageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[fetchShopSections] unexpected response', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}
