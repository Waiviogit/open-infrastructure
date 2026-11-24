import { Injectable } from '@nestjs/common';
import { objectTypeSupportsCategories } from '@opden-data-layer/core';
import type { AggregatedObject } from '@opden-data-layer/objects-domain';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository, ObjectCategoriesRepository } from '../../repositories';
import { AffiliateLinksEnricher, flattenAffiliateTargets } from '../affiliate';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import { parseTagFilters } from '../discover/get-discover-objects.endpoint';
import { USER_FAVORITES_CARD_UPDATE_TYPES } from '../favorites/favorites.constants';
import { UserFavoritesScopeResolver } from '../favorites/user-favorites-scope.resolver';
import { ObjectProjectionService } from '../object-projection';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import { SHOP_SECTION_OBJECTS_PER_CATEGORY } from './shop.constants';
import type { ShopSectionsQuery } from './shop.schema';

export type ShopSectionEntry = {
  categoryName: string;
  items: ProjectedObject[];
  /** Live count of the section's leaf list (scope ∩ lineage + name, same filters). */
  totalObjects: number;
};

/** The virtual Other block: scope objects of the lineage in none of the child categories. */
export type ShopOtherSection = {
  items: ProjectedObject[];
  totalObjects: number;
};

export type ShopSectionsResponse = {
  sections: ShopSectionEntry[];
  cursor: string | null;
  hasMore: boolean;
  /**
   * Last page only (`hasMore = false`), when the lineage has objects outside its child
   * categories (at the root: uncategorized ones and those only in hidden categories).
   */
  other: ShopOtherSection | null;
};

const EMPTY_SECTIONS: ShopSectionsResponse = {
  sections: [],
  cursor: null,
  hasMore: false,
  other: null,
};

function orderAggregatedByIds(objects: AggregatedObject[], objectIds: string[]): AggregatedObject[] {
  const map = new Map(objects.map((o) => [o.core.object_id, o]));
  return objectIds.map((id) => map.get(id)).filter((o): o is AggregatedObject => o != null);
}

/** Single category type the sections navigation reads, or null (no sections). */
function sectionsObjectType(types: readonly string[]): string | null {
  const [type] = types;
  return types.length === 1 && type != null && objectTypeSupportsCategories(type) ? type : null;
}

@Injectable()
export class GetUserShopSectionsEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly navigation: CategoryNavigationService,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
    private readonly affiliateLinks: AffiliateLinksEnricher,
  ) {}

  async execute(
    username: string,
    query: ShopSectionsQuery,
    locale: string,
    governanceObjectIdFromHeader: string | undefined,
    viewerAccount: string | undefined,
    countryCode: string | null = null,
  ): Promise<ShopSectionsResponse | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }

    const objectType = sectionsObjectType(query.types);
    if (objectType == null) {
      return { ...EMPTY_SECTIONS };
    }

    const scope = await this.scopeResolver.resolve(name, [objectType]);
    const tags = parseTagFilters(query.tags ?? []);
    const rating = query.rating ?? null;
    const nameSegment = query.name?.trim() ?? '';
    const lineage = nameSegment.length > 0 ? [...(query.path ?? []), nameSegment] : [];

    const nav = await this.navigation.build({
      scope: { kind: 'user', scope, tags: tags ?? [], rating: rating ?? null },
      objectType,
      lineage,
      excluded: [],
      includeHasChildren: false,
      includeOther: true,
    });
    const ordered = nav.items;

    let start = 0;
    const cursor = query.cursor?.trim();
    if (cursor && cursor.length > 0) {
      const idx = ordered.findIndex((it) => it.name === cursor);
      if (idx < 0) {
        return { ...EMPTY_SECTIONS };
      }
      start = idx + 1;
    }

    const pageItems = ordered.slice(start, start + query.sectionLimit);
    const hasMore = start + pageItems.length < ordered.length;
    if (pageItems.length === 0) {
      return { ...EMPTY_SECTIONS };
    }

    const withOther = !hasMore && nav.other_count > 0;
    const [idsByCategory, otherPage] = await Promise.all([
      this.objectCategoriesRepo.findObjectIdsByScopeForCategories({
        scope,
        parentPath: lineage,
        categoryNames: pageItems.map((item) => item.name),
        objectsPerCategory: SHOP_SECTION_OBJECTS_PER_CATEGORY,
        tags,
        rating,
      }),
      withOther
        ? this.objectCategoriesRepo.findObjectIdsByScope({
            scope,
            categoryPath: lineage,
            uncategorizedOnly: false,
            excludedCategoryNames: ordered.map((item) => item.name),
            limit: SHOP_SECTION_OBJECTS_PER_CATEGORY,
            cursor: null,
            tags,
            rating,
          })
        : Promise.resolve(null),
    ]);
    const otherIds = otherPage?.rows.map((row) => row.object_id) ?? [];

    const uniqueIds = [
      ...new Set([
        ...pageItems.flatMap((item) => idsByCategory.get(item.name) ?? []),
        ...otherIds,
      ]),
    ];
    const projectedById = await this.projectByIds(
      uniqueIds,
      locale,
      governanceObjectIdFromHeader,
      viewerAccount,
    );

    const sections: ShopSectionEntry[] = pageItems.map((item) => ({
      categoryName: item.name,
      items: (idsByCategory.get(item.name) ?? [])
        .map((id) => projectedById.get(id))
        .filter((p): p is ProjectedObject => p != null),
      totalObjects: item.objects_count,
    }));
    const otherItems = otherIds
      .map((id) => projectedById.get(id))
      .filter((p): p is ProjectedObject => p != null);
    const other: ShopOtherSection | null =
      otherItems.length > 0 ? { items: otherItems, totalObjects: nav.other_count } : null;

    await this.affiliateLinks.enrich(
      flattenAffiliateTargets([...sections, ...(other ? [other] : [])].flatMap((s) => s.items)),
      {
        countryCode,
        personalAccount: name,
        governanceObjectIdFromHeader,
      },
    );

    const lastSection = pageItems[pageItems.length - 1];
    return {
      sections,
      cursor: hasMore && lastSection ? lastSection.name : null,
      hasMore,
      other,
    };
  }

  private async projectByIds(
    objectIds: string[],
    locale: string,
    governanceObjectIdFromHeader: string | undefined,
    viewerAccount: string | undefined,
  ): Promise<Map<string, ProjectedObject>> {
    if (objectIds.length === 0) {
      return new Map();
    }
    const { objects, voterWaivPowers, rankVoteProjection } =
      await this.aggregatedObjectRepo.loadByObjectIds(objectIds, {
        viewerAccount,
      });
    const views = this.objectViewService.resolve(
      orderAggregatedByIds(objects, objectIds),
      voterWaivPowers,
      {
        update_types: [...USER_FAVORITES_CARD_UPDATE_TYPES],
        locale,
        include_rejected: false,
      },
    );
    const projected = await this.objectProjection.batchProject(views, {
      locale,
      includeSeo: false,
      governanceObjectIdFromHeader,
      viewerAccount,
      rankVoteProjection,
    });
    return new Map(projected.map((p) => [p.object_id, p]));
  }
}
