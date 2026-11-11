import 'server-only';

import { fail, ok, type Result } from '@/shared/domain/result';

import type { FavoritesFeedError, ShopSectionsPage } from '../../domain/types/shop-objects';
import { fetchShopSections, type FetchShopSectionsParams } from '../../infrastructure/clients/shop-objects.client';

const EMPTY_SHOP_SECTIONS_PAGE: ShopSectionsPage = { sections: [], cursor: null, hasMore: false };

/** One page of category sections; `service_unavailable` when query-api fails. */
export async function getShopSectionsResultQuery(
  accountName: string,
  params: FetchShopSectionsParams,
  viewer?: string | null,
): Promise<Result<ShopSectionsPage, FavoritesFeedError>> {
  const page = await fetchShopSections(accountName, params, { viewer });
  return page ? ok(page) : fail('service_unavailable');
}

/** RSC first page: degrades to no sections so the tab still renders. */
export async function getShopSectionsQuery(
  accountName: string,
  params: FetchShopSectionsParams,
  viewer?: string | null,
): Promise<ShopSectionsPage> {
  const result = await getShopSectionsResultQuery(accountName, params, viewer);
  return result.ok ? result.value : EMPTY_SHOP_SECTIONS_PAGE;
}
