import 'server-only';

import { cache } from 'react';

import {
  EMPTY_FAVORITES_TYPES_VIEW,
  toFavoritesTypesView,
  type FavoritesTypesView,
} from '../../domain/types/favorites';
import { fetchFavoritesTypes } from '../../infrastructure/clients/favorites.client';

async function getFavoritesTypesQueryUncached(accountName: string): Promise<FavoritesTypesView> {
  const response = await fetchFavoritesTypes(accountName);
  return response ? toFavoritesTypesView(response) : EMPTY_FAVORITES_TYPES_VIEW;
}

/** Favorites types of the account (count desc); one fetch per request for rail + main. */
export const getFavoritesTypesQuery = cache(getFavoritesTypesQueryUncached);
