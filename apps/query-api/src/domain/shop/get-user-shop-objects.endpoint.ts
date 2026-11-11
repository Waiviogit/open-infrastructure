import { Injectable } from '@nestjs/common';
import type { AggregatedObject } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository, ObjectCategoriesRepository } from '../../repositories';
import { AffiliateLinksEnricher, flattenAffiliateTargets } from '../affiliate';
import { parseTagFilters } from '../discover/get-discover-objects.endpoint';
import { USER_FAVORITES_CARD_UPDATE_TYPES } from '../favorites/favorites.constants';
import { UserFavoritesScopeResolver } from '../favorites/user-favorites-scope.resolver';
import { ObjectProjectionService } from '../object-projection';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import {
  decodeWeightObjectCursor,
  encodeWeightObjectCursor,
} from '../pagination/weight-object-cursor';
import type { ShopObjectsQuery } from './shop.schema';

export type ShopObjectsResponse = {
  items: ProjectedObject[];
  cursor: string | null;
  hasMore: boolean;
};

const EMPTY_PAGE: ShopObjectsResponse = { items: [], cursor: null, hasMore: false };

function orderAggregatedByIds(objects: AggregatedObject[], objectIds: string[]): AggregatedObject[] {
  const map = new Map(objects.map((o) => [o.core.object_id, o]));
  return objectIds.map((id) => map.get(id)).filter((o): o is AggregatedObject => o != null);
}

/** Flat Favorites list (leaf / uncategorized / filtered), `weight DESC NULLS LAST, object_id`. */
@Injectable()
export class GetUserShopObjectsEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
    private readonly affiliateLinks: AffiliateLinksEnricher,
  ) {}

  async execute(
    username: string,
    query: ShopObjectsQuery,
    locale: string,
    governanceObjectIdFromHeader: string | undefined,
    viewerAccount: string | undefined,
    countryCode: string | null = null,
  ): Promise<ShopObjectsResponse | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }

    const rawCursor = query.cursor?.trim();
    const cursor = rawCursor ? decodeWeightObjectCursor(rawCursor) : null;
    if (rawCursor && cursor == null) {
      return { ...EMPTY_PAGE };
    }

    const scope = await this.scopeResolver.resolve(name, query.types);
    const page = await this.objectCategoriesRepo.findObjectIdsByScope({
      scope,
      categoryPath: query.categoryPath,
      uncategorizedOnly: query.uncategorizedOnly,
      limit: query.limit,
      cursor,
      tags: parseTagFilters(query.tags ?? []),
      rating: query.rating ?? null,
    });

    if (page.rows.length === 0) {
      return { ...EMPTY_PAGE };
    }

    const pageIds = page.rows.map((row) => row.object_id);
    const { objects, voterWaivPowers, rankVoteProjection } =
      await this.aggregatedObjectRepo.loadByObjectIds(pageIds, {
        viewerAccount,
      });
    const ordered = orderAggregatedByIds(objects, pageIds);
    const views = this.objectViewService.resolve(ordered, voterWaivPowers, {
      update_types: [...USER_FAVORITES_CARD_UPDATE_TYPES],
      locale,
      include_rejected: false,
    });

    const projected = await this.objectProjection.batchProject(views, {
      locale,
      includeSeo: false,
      governanceObjectIdFromHeader,
      viewerAccount,
      rankVoteProjection,
    });

    await this.affiliateLinks.enrich(flattenAffiliateTargets(projected), {
      countryCode,
      personalAccount: name,
      governanceObjectIdFromHeader,
    });

    const lastRow = page.rows[page.rows.length - 1];
    const nextCursor =
      page.hasMore && lastRow != null
        ? encodeWeightObjectCursor({ weight: lastRow.weight, object_id: lastRow.object_id })
        : null;

    return {
      items: projected,
      cursor: nextCursor,
      hasMore: page.hasMore,
    };
  }
}
