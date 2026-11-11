'use server';

import { getShopObjectsResultQuery } from '@/modules/user-profile/application/queries/get-shop-objects.query';
import { getShopSectionsResultQuery } from '@/modules/user-profile/application/queries/get-shop-sections.query';
import {
  FAVORITES_OBJECTS_PAGE_SIZE,
  FAVORITES_SECTION_PREVIEW_LIMIT,
  type FavoritesFeedError,
  type ShopObjectsPage,
  type ShopSectionsPage,
} from '@/modules/user-profile/domain/types/shop-objects';
import { fail, type Result } from '@/shared/domain/result';
import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

export type LoadMoreFavoritesObjectsParams = {
  objectType: string;
  categoryPath: string[];
  uncategorizedOnly: boolean;
  tags: string[];
  rating: number | null;
  cursor: string;
};

export type LoadMoreFavoritesSectionsParams = {
  objectType: string;
  /** Parent department; undefined at the type root. */
  navName?: string;
  navPath: string[];
  tags: string[];
  rating: number | null;
  cursor: string;
};

async function readViewerUsername(): Promise<string | null> {
  const user = await createCookieAuthContextProvider().getUser();
  return user?.username ?? null;
}

/** Next Favorites objects page (cursor) for one type, category path and filters. */
export async function loadMoreFavoritesObjectsAction(
  accountName: string,
  params: LoadMoreFavoritesObjectsParams,
): Promise<Result<ShopObjectsPage, FavoritesFeedError>> {
  try {
    const viewer = await readViewerUsername();
    return await getShopObjectsResultQuery(
      accountName,
      {
        objectType: params.objectType,
        categoryPath: params.uncategorizedOnly ? [] : params.categoryPath,
        uncategorizedOnly: params.uncategorizedOnly ? true : undefined,
        tags: params.tags,
        rating: params.rating,
        cursor: params.cursor,
        limit: FAVORITES_OBJECTS_PAGE_SIZE,
      },
      viewer,
    );
  } catch (error) {
    console.error('[loadMoreFavoritesObjectsAction]', (error as Error).message);
    return fail('service_unavailable');
  }
}

/** Next page of category sections under the current node of a category type. */
export async function loadMoreFavoritesSectionsAction(
  accountName: string,
  params: LoadMoreFavoritesSectionsParams,
): Promise<Result<ShopSectionsPage, FavoritesFeedError>> {
  try {
    const viewer = await readViewerUsername();
    const name = params.navName?.trim();
    return await getShopSectionsResultQuery(
      accountName,
      {
        objectType: params.objectType,
        name: name && name.length > 0 ? name : undefined,
        path: params.navPath,
        tags: params.tags,
        rating: params.rating,
        cursor: params.cursor,
        sectionLimit: FAVORITES_SECTION_PREVIEW_LIMIT,
      },
      viewer,
    );
  } catch (error) {
    console.error('[loadMoreFavoritesSectionsAction]', (error as Error).message);
    return fail('service_unavailable');
  }
}
