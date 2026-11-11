import {
  favoritesTypesResponseSchema,
  toFavoritesTypesView,
  type FavoritesTypesView,
} from '../domain/types/favorites';

/** Browser read of the Favorites types through the BFF; null on any failure. */
export async function fetchProfileFavoritesTypes(
  accountName: string,
  signal?: AbortSignal,
): Promise<FavoritesTypesView | null> {
  const name = accountName.trim();
  if (name.length === 0) {
    return null;
  }
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(name)}/favorites/types`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    if (!res.ok) {
      return null;
    }
    const parsed = favoritesTypesResponseSchema.safeParse(await res.json());
    return parsed.success ? toFavoritesTypesView(parsed.data) : null;
  } catch {
    return null;
  }
}
