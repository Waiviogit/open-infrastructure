import 'server-only';

import { fail, ok, type Result } from '@/shared/domain/result';

import type { FavoritesFeedError, ShopObjectsPage } from '../../domain/types/shop-objects';
import { fetchShopObjects, type FetchShopObjectsParams } from '../../infrastructure/clients/shop-objects.client';

const EMPTY_SHOP_OBJECTS_PAGE: ShopObjectsPage = { items: [], cursor: null, hasMore: false };

/** One Favorites objects page; `service_unavailable` when query-api fails or answers malformed. */
export async function getShopObjectsResultQuery(
  accountName: string,
  params: FetchShopObjectsParams,
  viewer?: string | null,
): Promise<Result<ShopObjectsPage, FavoritesFeedError>> {
  const page = await fetchShopObjects(accountName, params, { viewer });
  return page ? ok(page) : fail('service_unavailable');
}

/** RSC first page: degrades to an empty page so the tab still renders. */
export async function getShopObjectsQuery(
  accountName: string,
  params: FetchShopObjectsParams,
  viewer?: string | null,
): Promise<ShopObjectsPage> {
  const result = await getShopObjectsResultQuery(accountName, params, viewer);
  return result.ok ? result.value : EMPTY_SHOP_OBJECTS_PAGE;
}
