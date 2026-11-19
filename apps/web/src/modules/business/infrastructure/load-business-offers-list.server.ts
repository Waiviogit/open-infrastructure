import type { OblOfferKindRoute, OffersListTab } from '../domain/routes';
import { OBL_LIST_PAGE_SIZE } from '../domain/obl-pagination.types';
import { fetchOblDraftList } from './clients/obl-drafts.server';
import { searchOblOffers } from './clients/obl-offers.server';
import { requireBusinessUser } from './require-business-user.server';

const EMPTY_PAGE = { items: [], hasMore: false };

/**
 * Owner lists for `/business/manage/{offers|requests}/{tab}`. Published / retired rows are
 * filtered by kind on the server; drafts have no kind filter in the API, so the client keeps
 * paging until it finds rows of this kind. `loadFailed` is true when query-api did not answer.
 */
export async function loadBusinessOffersList(
  kind: OblOfferKindRoute,
  tab: OffersListTab,
) {
  const { username } = await requireBusinessUser();
  if (tab === 'drafts') {
    const drafts = await fetchOblDraftList(username, {
      limit: OBL_LIST_PAGE_SIZE,
      offset: 0,
    });
    return {
      username,
      drafts: drafts ?? EMPTY_PAGE,
      published: EMPTY_PAGE,
      loadFailed: drafts === null,
    };
  }
  const published = await searchOblOffers({
    author: username,
    kind,
    status: tab === 'retired' ? 'retired' : 'active',
    limit: OBL_LIST_PAGE_SIZE,
    offset: 0,
  });
  return {
    username,
    drafts: EMPTY_PAGE,
    published: published ?? EMPTY_PAGE,
    loadFailed: published === null,
  };
}
