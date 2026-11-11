import { Injectable } from '@nestjs/common';
import {
  ObjectCategoriesRelatedRepository,
  ObjectCategoriesRepository,
  type CategoryNamePair,
  type UserFavoritesScope,
  type UserFavoritesTagFilter,
} from '../../repositories';
import { ROOT_DEPARTMENTS_LIMIT } from './category-navigation.constants';
import type { CategoryNavigationRow } from './category-navigation.types';
import type { UserCategoryNavItem } from './categories-query.schema';
import { selectCategoryCandidates, toCategoryNavigationRows } from './category-candidates';

export type UserCategoryNavigationInput = {
  scope: UserFavoritesScope;
  /** Single category object type (selects the precomputed `acc:type` rows). */
  objectType: string;
  /** Selected category path; empty = root. */
  lineage: readonly string[];
  excluded: readonly string[];
  /** Compute `has_children` (one extra grouped query). */
  includeHasChildren: boolean;
  tags?: readonly UserFavoritesTagFilter[];
  rating?: number | null;
};

export type UserCategoryNavigation = {
  items: UserCategoryNavItem[];
  show_other: boolean;
};

/**
 * Category navigation for one type and lineage. Precomputed `object_categories_related` rows
 * only choose candidates and their order; every displayed number is a live
 * `COUNT(DISTINCT object_id)` over the Favorites scope ∩ full lineage, and children with an
 * empty intersection are dropped.
 * @see docs/apps/query-api/spec/categories.md
 */
@Injectable()
export class UserCategoryNavigationService {
  constructor(
    private readonly relatedRepo: ObjectCategoriesRelatedRepository,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
  ) {}

  async build(input: UserCategoryNavigationInput): Promise<UserCategoryNavigation> {
    const relatedRows = await this.relatedRepo.findByUserCategoryScope(
      input.scope.account,
      input.objectType,
    );
    const navRows = toCategoryNavigationRows(relatedRows);
    const candidates = selectCategoryCandidates(navRows, input.lineage, input.excluded);
    if (candidates.length === 0) {
      return { items: [], show_other: false };
    }

    const counts = await this.objectCategoriesRepo.countObjectIdsByScopeForCategories({
      scope: input.scope,
      parentPath: input.lineage,
      categoryNames: candidates,
      tags: input.tags,
      rating: input.rating,
    });
    const nonEmpty = candidates.filter((name) => (counts.get(name) ?? 0) > 0);

    const isRoot = input.lineage.length === 0;
    const visible = isRoot ? nonEmpty.slice(0, ROOT_DEPARTMENTS_LIMIT) : nonEmpty;
    const show_other = isRoot && nonEmpty.length > ROOT_DEPARTMENTS_LIMIT;

    const withChildren = input.includeHasChildren
      ? await this.findNamesWithChildren(input.scope, navRows, input.lineage, visible)
      : new Set<string>();

    return {
      items: visible.map((name) => ({
        name,
        objects_count: counts.get(name) ?? 0,
        has_children: withChildren.has(name),
      })),
      show_other,
    };
  }

  /**
   * Names whose drill-down would list at least one child: some grandchild candidate
   * (same heuristics as the drill-down) has a non-empty live intersection with lineage + name.
   */
  private async findNamesWithChildren(
    scope: UserFavoritesScope,
    navRows: CategoryNavigationRow[],
    lineage: readonly string[],
    names: readonly string[],
  ): Promise<Set<string>> {
    const pairs: CategoryNamePair[] = names.flatMap((name) =>
      selectCategoryCandidates(navRows, [...lineage, name], []).map((child) => ({
        first: name,
        second: child,
      })),
    );
    if (pairs.length === 0) {
      return new Set();
    }
    const pairCounts = await this.objectCategoriesRepo.countCategoryPairsByScope({
      scope,
      parentPath: lineage,
      pairs,
    });
    return new Set(
      pairs
        .filter((pair) => (pairCounts.get(pair.first)?.get(pair.second) ?? 0) > 0)
        .map((pair) => pair.first),
    );
  }
}
