import {
  placeDetailsSchema,
  placeObjectResponseSchema,
  placesSearchResponseSchema,
  type PlaceDetails,
  type PlaceSearchItem,
} from '../domain/place.schema';

const HTTP_NOT_FOUND = 404;

async function getJson(
  url: string,
  signal?: AbortSignal,
): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    let body: unknown = null;
    try {
      body = (await res.json()) as unknown;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/** Google Maps places near the user; empty on any failure (the menu still shows our objects). */
export async function fetchPlacesSearch(
  query: string,
  init?: { signal?: AbortSignal },
): Promise<PlaceSearchItem[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const res = await getJson(`/api/places/search?${new URLSearchParams({ q }).toString()}`, init?.signal);
  if (!res || res.status !== 200) {
    return [];
  }
  const parsed = placesSearchResponseSchema.safeParse(res.body);
  return parsed.success ? parsed.data.places : [];
}

export type PlaceDetailsResult =
  | { ok: true; details: PlaceDetails }
  | { ok: false; error: 'not_found' | 'service_unavailable' };

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const res = await getJson(`/api/places/${encodeURIComponent(placeId)}`);
  if (!res) {
    return { ok: false, error: 'service_unavailable' };
  }
  if (res.status === HTTP_NOT_FOUND) {
    return { ok: false, error: 'not_found' };
  }
  const parsed = placeDetailsSchema.safeParse(res.body);
  if (res.status !== 200 || !parsed.success) {
    return { ok: false, error: 'service_unavailable' };
  }
  return { ok: true, details: parsed.data };
}

/**
 * Object already linked to the place. `unknown` = lookup failed; creating then
 * could produce a duplicate, so callers must not broadcast.
 */
export type PlaceObjectLookup =
  | { status: 'found'; objectId: string }
  | { status: 'absent' }
  | { status: 'unknown' };

export async function fetchObjectForPlace(placeId: string): Promise<PlaceObjectLookup> {
  const res = await getJson(`/api/places/${encodeURIComponent(placeId)}/object`);
  if (!res) {
    return { status: 'unknown' };
  }
  if (res.status === HTTP_NOT_FOUND) {
    return { status: 'absent' };
  }
  const parsed = placeObjectResponseSchema.safeParse(res.body);
  if (res.status !== 200 || !parsed.success) {
    return { status: 'unknown' };
  }
  return { status: 'found', objectId: parsed.data.object_id };
}
