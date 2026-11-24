import { Injectable } from '@nestjs/common';
import { DiscoverRepository } from '../../repositories';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import { resolveDiscoverOtherExcludedNames } from './discover-other';
import { DiscoverObjectProjector } from './discover-object-projector';
import type { DiscoverObjectsQuery } from './discover-query.schema';
import type { DiscoverObjectsResponseDto } from './discover.types';

export interface GetDiscoverObjectsInput {
  query: DiscoverObjectsQuery;
  locale: string;
  viewerAccount?: string;
  governanceObjectIdFromHeader?: string;
  countryCode?: string | null;
}

/** Parses `category:value` query tags; skips legacy value-only strings. */
export function parseTagFilters(
  raw: string[],
): Array<{ category: string; value: string }> {
  return raw.flatMap((s) => {
    const idx = s.indexOf(':');
    if (idx < 1) {
      return [];
    }
    const category = s.slice(0, idx);
    const value = s.slice(idx + 1);
    if (value.length === 0) {
      return [];
    }
    return [{ category, value }];
  });
}

@Injectable()
export class GetDiscoverObjectsEndpoint {
  constructor(
    private readonly discoverRepo: DiscoverRepository,
    private readonly projector: DiscoverObjectProjector,
    private readonly navigation: CategoryNavigationService,
  ) {}

  async execute(input: GetDiscoverObjectsInput): Promise<DiscoverObjectsResponseDto> {
    const q = input.query.q?.trim();
    if (q && q.length > 0 && !input.query.object_type) {
      // Text search without type is allowed but may be heavy; still proceed.
    }

    const tags = parseTagFilters(input.query.tags);
    const excludedCategoryNames = input.query.other
      ? await resolveDiscoverOtherExcludedNames(this.navigation, {
          objectType: input.query.object_type,
          categoryPath: input.query.category_path,
          q: q ?? '',
          tags,
          box: input.query.box ?? null,
        })
      : [];
    if (excludedCategoryNames == null) {
      return { items: [], cursor: null, hasMore: false };
    }

    const { rows, hasMore } = await this.discoverRepo.listObjects({
      objectType: input.query.object_type,
      q: q && q.length > 0 ? q : undefined,
      tags,
      sort: input.query.sort,
      cursor: input.query.cursor,
      limit: input.query.limit,
      viewerAccount: input.viewerAccount,
      box: input.query.box,
      categoryPath: input.query.category_path,
      excludedCategoryNames,
    });

    if (rows.length === 0) {
      return { items: [], cursor: null, hasMore: false };
    }

    const projected = await this.projector.project(
      rows.map((r) => r.object_id),
      {
        locale: input.locale,
        viewerAccount: input.viewerAccount,
        governanceObjectIdFromHeader: input.governanceObjectIdFromHeader,
        countryCode: input.countryCode,
      },
    );

    const lastRow = rows[rows.length - 1];
    const cursor = hasMore
      ? this.discoverRepo.buildObjectCursor(lastRow, input.query.sort)
      : null;

    return {
      items: projected,
      cursor,
      hasMore,
    };
  }
}
