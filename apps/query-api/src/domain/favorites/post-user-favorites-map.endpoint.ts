import { Injectable } from '@nestjs/common';
import { MAP_GEO_OBJECT_TYPES } from '@opden-data-layer/core';
import type { AggregatedObject } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository, UserFavoritesRepository } from '../../repositories';
import { ObjectProjectionService } from '../object-projection';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import { USER_FAVORITES_MAP_UPDATE_TYPES } from './favorites.constants';
import type { UserFavoritesMapBody, UserFavoritesMapResponse } from './post-user-favorites-map.schema';
import { UserFavoritesScopeResolver } from './user-favorites-scope.resolver';

function orderAggregatedByIds(objects: AggregatedObject[], objectIds: string[]): AggregatedObject[] {
  const map = new Map(objects.map((o) => [o.core.object_id, o]));
  return objectIds.map((id) => map.get(id)).filter((o): o is AggregatedObject => o != null);
}

/** Requested map types ∩ `MAP_GEO_OBJECT_TYPES`; omitted → every map type. */
export function resolveMapObjectTypes(requested: readonly string[] | undefined): string[] {
  if (requested == null || requested.length === 0) {
    return [...MAP_GEO_OBJECT_TYPES];
  }
  const allowed = new Set<string>(MAP_GEO_OBJECT_TYPES);
  return requested.filter((type) => allowed.has(type));
}

@Injectable()
export class PostUserFavoritesMapEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly favoritesRepo: UserFavoritesRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
  ) {}

  async execute(
    username: string,
    body: UserFavoritesMapBody,
    locale: string,
    governanceObjectIdFromHeader: string | undefined,
    viewerAccount: string | undefined,
  ): Promise<UserFavoritesMapResponse | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }

    const scope = await this.scopeResolver.resolve(name, resolveMapObjectTypes(body.objectTypes));
    const fetchLimit = body.limit + 1;
    const objectIds = await this.favoritesRepo.findMapObjectIdsByScope(
      scope,
      body.box,
      body.skip,
      fetchLimit,
    );

    const hasMore = objectIds.length > body.limit;
    const pageIds = hasMore ? objectIds.slice(0, body.limit) : objectIds;

    if (pageIds.length === 0) {
      return { items: [], hasMore: false };
    }

    const { objects, voterWaivPowers, rankVoteProjection } =
      await this.aggregatedObjectRepo.loadByObjectIds(pageIds, {
        viewerAccount,
      });
    const ordered = orderAggregatedByIds(objects, pageIds);

    const views = this.objectViewService.resolve(ordered, voterWaivPowers, {
      update_types: [...USER_FAVORITES_MAP_UPDATE_TYPES],
      locale,
      include_rejected: false,
    });

    const items: ProjectedObject[] = await this.objectProjection.batchProject(views, {
      locale,
      includeSeo: false,
      governanceObjectIdFromHeader,
      viewerAccount,
      rankVoteProjection,
    });

    return { items, hasMore };
  }
}
