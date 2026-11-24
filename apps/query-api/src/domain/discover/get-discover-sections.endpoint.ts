import { Injectable } from '@nestjs/common';

import { DISCOVER_SECTION_OBJECTS_PER_CATEGORY } from '../../constants/discover.constants';
import { DiscoverRepository } from '../../repositories';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import type { ProjectedObject } from '../object-projection/projected-object.types';
import { DiscoverObjectProjector } from './discover-object-projector';
import type { DiscoverSectionsQuery } from './discover-query.schema';
import type { DiscoverSectionsResponseDto } from './discover.types';

export interface GetDiscoverSectionsInput {
  query: DiscoverSectionsQuery;
  locale: string;
  viewerAccount?: string;
  governanceObjectIdFromHeader?: string;
  countryCode?: string | null;
}

const EMPTY_SECTIONS: DiscoverSectionsResponseDto = {
  sections: [],
  cursor: null,
  hasMore: false,
  other: null,
};

/**
 * Category blocks of a Discover category: one block per child category of `category_path` (the
 * category tree's children: display rules, order by count), each with its top objects by rank
 * (one per group) and its group count. Paged by the last block's category name. The last page
 * also carries the virtual Other block (groups of the category in none of its children).
 * @see docs/apps/query-api/spec/discover-categories.md
 */
@Injectable()
export class GetDiscoverSectionsEndpoint {
  constructor(
    private readonly navigation: CategoryNavigationService,
    private readonly discoverRepo: DiscoverRepository,
    private readonly projector: DiscoverObjectProjector,
  ) {}

  async execute(input: GetDiscoverSectionsInput): Promise<DiscoverSectionsResponseDto> {
    const objectType = input.query.object_type.trim();
    const lineage = input.query.category_path;

    const nav = await this.navigation.build({
      scope: { kind: 'type', objectType, q: '', tags: [], box: null },
      objectType,
      lineage,
      excluded: [],
      includeHasChildren: false,
      includeOther: true,
    });
    const ordered = nav.items;

    let start = 0;
    const cursor = input.query.cursor?.trim();
    if (cursor) {
      const index = ordered.findIndex((item) => item.name === cursor);
      if (index < 0) {
        return { ...EMPTY_SECTIONS };
      }
      start = index + 1;
    }
    const pageItems = ordered.slice(start, start + input.query.section_limit);
    if (pageItems.length === 0) {
      return { ...EMPTY_SECTIONS };
    }
    const hasMore = start + pageItems.length < ordered.length;

    const topIds = async (
      categoryPath: readonly string[],
      excludedCategoryNames: readonly string[] = [],
    ): Promise<string[]> => {
      const { rows } = await this.discoverRepo.listObjects({
        objectType,
        tags: [],
        sort: 'rank',
        limit: DISCOVER_SECTION_OBJECTS_PER_CATEGORY,
        viewerAccount: input.viewerAccount,
        categoryPath,
        excludedCategoryNames,
      });
      return rows.map((row) => row.object_id);
    };
    const withOther = !hasMore && nav.other_count > 0;
    const [idsByCategory, otherIds] = await Promise.all([
      Promise.all(pageItems.map((item) => topIds([...lineage, item.name]))),
      withOther
        ? topIds(
            lineage,
            ordered.map((item) => item.name),
          )
        : Promise.resolve([] as string[]),
    ]);

    const projected = await this.projector.project([...new Set([...idsByCategory.flat(), ...otherIds])], {
      locale: input.locale,
      viewerAccount: input.viewerAccount,
      governanceObjectIdFromHeader: input.governanceObjectIdFromHeader,
      countryCode: input.countryCode,
    });
    const byId = new Map(projected.map((object) => [object.object_id, object]));

    const sections = pageItems.map((item, index) => ({
      categoryName: item.name,
      items: (idsByCategory[index] ?? [])
        .map((id) => byId.get(id))
        .filter((object): object is ProjectedObject => object != null),
      totalObjects: item.objects_count,
    }));
    const otherItems = otherIds
      .map((id) => byId.get(id))
      .filter((object): object is ProjectedObject => object != null);

    return {
      sections,
      cursor: hasMore ? (pageItems[pageItems.length - 1]?.name ?? null) : null,
      hasMore,
      other: otherItems.length > 0 ? { items: otherItems, totalObjects: nav.other_count } : null,
    };
  }
}
