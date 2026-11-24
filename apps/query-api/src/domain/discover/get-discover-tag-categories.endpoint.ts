import { Injectable } from '@nestjs/common';
import { DiscoverRepository } from '../../repositories';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import { resolveDiscoverOtherExcludedNames } from './discover-other';
import { getTagCategoryOrderForObjectType } from './discover-registry.utils';
import { groupDiscoverTagCategories } from './discover-tag-categories.utils';
import { parseTagFilters } from './get-discover-objects.endpoint';
import type { DiscoverTagCategoriesQuery } from './discover-query.schema';
import type { DiscoverTagCategoriesResponseDto } from './discover.types';

export interface GetDiscoverTagCategoriesInput {
  query: DiscoverTagCategoriesQuery;
}

@Injectable()
export class GetDiscoverTagCategoriesEndpoint {
  constructor(
    private readonly discoverRepo: DiscoverRepository,
    private readonly navigation: CategoryNavigationService,
  ) {}

  async execute(input: GetDiscoverTagCategoriesInput): Promise<DiscoverTagCategoriesResponseDto> {
    const objectType = input.query.object_type.trim();
    const activeTags = parseTagFilters(input.query.tags ?? []);
    const q = input.query.q?.trim() || undefined;
    const excludedCategoryNames = input.query.other
      ? await resolveDiscoverOtherExcludedNames(this.navigation, {
          objectType,
          categoryPath: input.query.category_path,
          q: q ?? '',
          tags: activeTags,
          box: input.query.box ?? null,
        })
      : [];
    const order = getTagCategoryOrderForObjectType(objectType);
    if (excludedCategoryNames == null) {
      return groupDiscoverTagCategories([], order);
    }
    const rows = await this.discoverRepo.getTagCategories(
      objectType,
      activeTags,
      q,
      input.query.box,
      input.query.category_path,
      excludedCategoryNames,
    );
    return groupDiscoverTagCategories(rows, order);
  }
}
