import {
  discoverCategoriesResponseSchema,
  discoverObjectsPageSchema,
  discoverSectionsPageSchema,
  discoverTagCategoriesResponseSchema,
  discoverUsersPageSchema,
  type DiscoverCategoriesResponse,
  type DiscoverObjectsPage,
  type DiscoverSectionsPage,
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
  /** The Other category of `categoryPath`. */
  categoryOther?: boolean;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
};

/**
 * Repeated `category_path` query values, root first (query-api `category_names @> path`), and
 * `other=true` for the Other category of a non-empty lineage.
 */
function appendCategoryPath(
  sp: URLSearchParams,
  categoryPath: readonly string[] | undefined,
  categoryOther = false,
): void {
  let hasCategory = false;
  for (const segment of categoryPath ?? []) {
    const trimmed = segment.trim();
    if (trimmed) {
      sp.append('category_path', trimmed);
      hasCategory = true;
    }
  }
  if (hasCategory && categoryOther) {
    sp.set('other', 'true');
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
  appendCategoryPath(sp, params.categoryPath, params.categoryOther);
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
  categoryOther = false,
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
  appendCategoryPath(sp, categoryPath, categoryOther);
  return sp;
}

export async function fetchDiscoverTagCategories(
  objectType: string,
  init?: {
    tags?: readonly string[];
    q?: string;
    box?: DiscoverBox;
    categoryPath?: readonly string[];
    categoryOther?: boolean;
    signal?: AbortSignal;
  },
): Promise<DiscoverTagCategoriesResponse | null> {
  const sp = buildDiscoverTagCategoriesSearchParams(
    objectType,
    init?.tags ?? [],
    init?.q,
    init?.box,
    init?.categoryPath ?? [],
    init?.categoryOther ?? false,
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

/** One page of category blocks under `categoryPath` (non-empty); null when the request fails. */
export async function fetchDiscoverSections(
  objectType: string,
  init: {
    categoryPath: readonly string[];
    cursor?: string | null;
    sectionLimit?: number;
    signal?: AbortSignal;
  },
): Promise<DiscoverSectionsPage | null> {
  const sp = new URLSearchParams({ object_type: objectType.trim() });
  appendCategoryPath(sp, init.categoryPath);
  if (init.cursor?.trim()) {
    sp.set('cursor', init.cursor.trim());
  }
  if (init.sectionLimit != null) {
    sp.set('section_limit', String(init.sectionLimit));
  }
  try {
    const res = await fetch(`/api/discover/sections?${sp.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: init.signal,
    });
    if (!res.ok) {
      return null;
    }
    const raw: unknown = await res.json();
    const parsed = discoverSectionsPageSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
