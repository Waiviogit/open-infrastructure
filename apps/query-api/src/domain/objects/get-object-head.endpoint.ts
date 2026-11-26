import { Injectable } from '@nestjs/common';
import { OBJECT_PAGE_VISIBLE_STATUSES, UPDATE_TYPES } from '@opden-data-layer/core';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository } from '../../repositories';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection/object-projection.service';
import { emptyRankVoteProjection } from '../object-projection/projected-object.types';
import type { ObjectHeadDto } from './object-head.types';

/**
 * Update types the object page hero paints from: name, subtitle (`title`), avatar (`image`, falling
 * back to the parent's), cover (`imageBackground`) and `identifier` (recipe Instacart button).
 * `parent` is resolved only for that avatar fallback and is not returned.
 */
export const OBJECT_HEAD_UPDATE_TYPES = [
  UPDATE_TYPES.NAME,
  UPDATE_TYPES.TITLE,
  UPDATE_TYPES.IMAGE,
  UPDATE_TYPES.IMAGE_BACKGROUND,
  UPDATE_TYPES.PARENT,
  UPDATE_TYPES.IDENTIFIER,
] as const;

export interface GetObjectHeadInput {
  objectId: string;
  locale: string;
  governanceObjectIdFromHeader?: string;
}

/**
 * Viewer-independent head of an object page: what the hero needs before the full
 * `POST /objects/resolve` (counts, SEO, affiliate links, every field) arrives.
 * Same projection as the full resolve, restricted to {@link OBJECT_HEAD_UPDATE_TYPES}.
 * @see docs/apps/query-api/spec/object-head.md
 */
@Injectable()
export class GetObjectHeadEndpoint {
  constructor(
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly objectProjectionService: ObjectProjectionService,
  ) {}

  async execute(input: GetObjectHeadInput): Promise<ObjectHeadDto | null> {
    const { objects, voterWaivPowers } = await this.aggregatedObjectRepo.loadByObjectIds(
      [input.objectId],
      { includeRankVoteProjection: false, statuses: OBJECT_PAGE_VISIBLE_STATUSES },
    );
    if (objects.length === 0) {
      return null;
    }

    const governance = await this.governanceResolver.resolveMergedForObjectView(
      input.governanceObjectIdFromHeader,
    );
    const [view] = this.objectViewService.resolve(objects, voterWaivPowers, {
      update_types: [...OBJECT_HEAD_UPDATE_TYPES],
      locale: input.locale,
      include_rejected: false,
      governance,
    });
    if (!view) {
      return null;
    }

    const projected = await this.objectProjectionService.project(view, {
      locale: input.locale,
      governance,
      governanceObjectIdFromHeader: input.governanceObjectIdFromHeader,
      rankVoteProjection: emptyRankVoteProjection(),
    });

    const fields = Object.fromEntries(
      Object.entries(projected.fields).filter(([key]) => key !== UPDATE_TYPES.PARENT),
    );
    return {
      object_id: projected.object_id,
      object_type: projected.object_type,
      semantic_type: projected.semantic_type,
      status: projected.status,
      weight: projected.weight,
      fields,
      previewGallery: projected.previewGallery ?? [],
      galleryAlbums: projected.galleryAlbums ?? [],
    };
  }
}
