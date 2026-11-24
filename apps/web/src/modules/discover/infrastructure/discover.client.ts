import {
  discoverCategoriesResponseSchema,
  discoverObjectsPageSchema,
  discoverTagCategoriesResponseSchema,
  discoverUsersPageSchema,
  type DiscoverCategoriesResponse,
  type DiscoverObjectsPage,
  type DiscoverTagCategoriesResponse,
  type DiscoverUsersPage,
} from '../domain/discover-response.schema';

import { DISCOVER_ALL_OBJECT_TYPES, formatDiscoverBoxParam, type DiscoverBox } from '../domain/discover-url';

function shouldSendObjectTypeToApi(objectType: string | undefined): boolean {
  const trimmed = objectType?.trim();
  return Boolean(trimmed && trimmed !== DISCOVER_ALL_OBJECT_TYPES);
}

export type FetchDiscoverObjectsParams = {
  objectType?: string;
  q?: string;
  tags?: string[];
  sort?: 'newest' | 'oldest' | 'rank';
  box?: DiscoverBox;
  /** Category lineage, root first. */
  categoryPath?: readonly string[];
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

/** Repeated `category_path` query values, root first (query-api `category_names @> path`). */
function appendCategoryPath(sp: URLSearchParams, categoryPath: readonly string[] | undefined): void {
  for (const segment of categoryPath ?? []) {
    const trimmed = segment.trim();
    if (trimmed) {
      sp.append('category_path', trimmed);
    }
  }
}

export async function fetchDiscoverObjects(
  params: FetchDiscoverObjectsParams,
): Promise<DiscoverObjectsPage | null> {
  const sp = new URLSearchParams();
  if (shouldSendObjectTypeToApi(params.objectType)) {
    sp.set('object_type', params.objectType!.trim());
  }
  if (params.q?.trim()) {
    sp.set('q', params.q.trim());
  }
  for (const tag of params.tags ?? []) {
    const t = tag.trim();
    if (t) {
      sp.append('tags', t);
    }
  }
  sp.set('sort', params.sort ?? 'rank');
  if (params.box) {
    sp.set('box', formatDiscoverBoxParam(params.box));
  }
  appendCategoryPath(sp, params.categoryPath);
  if (params.cursor?.trim()) {
    sp.set('cursor', params.cursor.trim());
  }
  if (params.limit != null) {
    sp.set('limit', String(params.limit));
  }

  try {
    const res = await fetch(`/api/discover/objects?${sp.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: params.signal,
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = discoverObjectsPageSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type FetchDiscoverUsersParams = {
  q?: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

export async function fetchDiscoverUsers(
  params: FetchDiscoverUsersParams,
): Promise<DiscoverUsersPage | null> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) {
    sp.set('q', params.q.trim());
  }
  if (params.cursor?.trim()) {
    sp.set('cursor', params.cursor.trim());
  }
  if (params.limit != null) {
    sp.set('limit', String(params.limit));
  }

  try {
    const res = await fetch(`/api/discover/users?${sp.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: params.signal,
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = discoverUsersPageSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildDiscoverTagCategoriesSearchParams(
  objectType: string,
  tags: readonly string[] = [],
  q?: string,
  box?: DiscoverBox,
  categoryPath: readonly string[] = [],
): URLSearchParams {
  const sp = new URLSearchParams({ object_type: objectType.trim() });
  const qTrimmed = q?.trim();
  if (qTrimmed) {
    sp.set('q', qTrimmed);
  }
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed) {
      sp.append('tags', trimmed);
    }
  }
  if (box) {
    sp.set('box', formatDiscoverBoxParam(box));
  }
  appendCategoryPath(sp, categoryPath);
  return sp;
}

export async function fetchDiscoverTagCategories(
  objectType: string,
  init?: {
    tags?: readonly string[];
    q?: string;
    box?: DiscoverBox;
    categoryPath?: readonly string[];
    signal?: AbortSignal;
  },
): Promise<DiscoverTagCategoriesResponse | null> {
  const sp = buildDiscoverTagCategoriesSearchParams(
    objectType,
    init?.tags ?? [],
    init?.q,
    init?.box,
    init?.categoryPath ?? [],
  );
  try {
    const res = await fetch(`/api/discover/tag-categories?${sp.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: init?.signal,
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = discoverTagCategoriesResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * One level of the type's category tree (children of `categoryPath`), counted in groups and
 * narrowed by the search, tags and map area. Null when the request fails.
 */
export async function fetchDiscoverCategories(
  objectType: string,
  init: {
    categoryPath: readonly string[];
    tags?: readonly string[];
    q?: string;
    box?: DiscoverBox;
    signal?: AbortSignal;
  },
): Promise<DiscoverCategoriesResponse | null> {
  const sp = buildDiscoverTagCategoriesSearchParams(
    objectType,
    init.tags ?? [],
    init.q,
    init.box,
    init.categoryPath,
  );
  try {
    const res = await fetch(`/api/discover/categories?${sp.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: init.signal,
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = discoverCategoriesResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
