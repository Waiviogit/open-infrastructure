import { Injectable } from '@nestjs/common';
import {
  ObjectCategoriesRelatedRepository,
  ObjectCategoriesRepository,
  type CategoryCountScope,
  type CategoryNamePair,
} from '../../repositories';
import {
  filterShownCategories,
  isNearDuplicateByCounts,
  isNearDuplicateByGroupKeys,
  NEAR_DUPLICATE_MAX_CANDIDATES,
  passesCategoryDisplayRules,
  precomputedTypeTotal,
  selectCategoryCandidates,
  selectRootCategories,
  toCategoryNavigationRows,
  type CategoryNavigationRow,
} from '@opden-data-layer/category-scopes';
import type { UserCategoryNavItem } from './categories-query.schema';

export type CategoryNavigationInput = {
  scope: CategoryCountScope;
  /** Single category object type (selects the precomputed `acc:type` or type rows). */
  objectType: string;
  /** Selected category path; empty = root. */
  lineage: readonly string[];
  excluded: readonly string[];
  /** Compute `has_children` (one extra grouped query). */
  includeHasChildren: boolean;
};

export type CategoryNavigation = {
  items: UserCategoryNavItem[];
  show_other: boolean;
};

type PairCounts = Map<string, Map<string, number>>;

const EMPTY_NAVIGATION: CategoryNavigation = { items: [], show_other: false };

/**
 * Category navigation for one type and lineage, over a user's Favorites or a whole type
 * (Discover). Precomputed `object_categories_related` rows choose candidates; numbers are live
 * counts over the scope ∩ lineage ∩ filters, except the unfiltered root of a type, served from
 * the type scope's precomputed counts. The client's display rules (at least 3 units, at most 60%
 * of the level) decide what is shown.
 * @see docs/apps/query-api/spec/categories.md
 */
@Injectable()
export class CategoryNavigationService {
  constructor(
    private readonly relatedRepo: ObjectCategoriesRelatedRepository,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
  ) {}

  async build(input: CategoryNavigationInput): Promise<CategoryNavigation> {
    const relatedRows = await this.loadRelatedRows(input);
    const navRows = toCategoryNavigationRows(relatedRows);
    const candidates = selectCategoryCandidates(navRows, input.lineage, input.excluded);
    if (candidates.length === 0) {
      return { ...EMPTY_NAVIGATION };
    }

    // Unfiltered root of a type: the precomputed type scope already holds the numbers (as of its
    // last rebuild), so no query over the whole type is needed.
    const precomputedTotal = isUnfilteredTypeRoot(input) ? precomputedTypeTotal(relatedRows) : null;
    const level =
      precomputedTotal != null
        ? {
            counts: new Map(navRows.map((row) => [row.category_name, row.objects_count])),
            total: precomputedTotal,
          }
        : await this.objectCategoriesRepo.countCategoryLevel({
            scope: input.scope,
            parentPath: input.lineage,
            categoryNames: candidates,
          });
    const countOf = (name: string) => level.counts.get(name) ?? 0;
    const root =
      input.lineage.length === 0
        ? selectRootCategories(navRows, candidates, countOf, level.total)
        : null;
    const visible =
      root?.names ??
      (await this.dropNearDuplicates(
        input.scope,
        navRows,
        input.lineage,
        filterShownCategories(candidates, countOf, level.total),
        countOf,
      ));
    const show_other = root?.showOther ?? false;

    const pairCountsFor = (pairs: CategoryNamePair[]): Promise<PairCounts> =>
      precomputedTotal != null
        ? Promise.resolve(precomputedPairCounts(navRows, pairs))
        : this.objectCategoriesRepo.countCategoryPairsByScope({
            scope: input.scope,
            parentPath: input.lineage,
            pairs,
          });
    const withChildren = input.includeHasChildren
      ? await findNamesWithChildren(navRows, input.lineage, visible, countOf, pairCountsFor)
      : new Set<string>();

    return {
      items: visible.map((name) => ({
        name,
        objects_count: countOf(name),
        has_children: withChildren.has(name),
      })),
      show_other,
    };
  }

  private loadRelatedRows(input: CategoryNavigationInput) {
    if (input.scope.kind === 'user') {
      return this.relatedRepo.findByUserCategoryScope(input.scope.scope.account, input.objectType);
    }
    return this.relatedRepo.findByScope('type', input.objectType);
  }

  /**
   * Greedy by count: a category nearly identical to a stronger kept one is dropped. User scopes
   * compare precomputed `group_keys`; type scopes (no stored keys) use live pair counts for the
   * top {@link NEAR_DUPLICATE_MAX_CANDIDATES}, the rest is kept unchecked.
   */
  private async dropNearDuplicates(
    scope: CategoryCountScope,
    navRows: CategoryNavigationRow[],
    lineage: readonly string[],
    sortedNames: string[],
    countOf: (name: string) => number,
  ): Promise<string[]> {
    if (sortedNames.length < 2) {
      return sortedNames;
    }
    if (scope.kind === 'user') {
      const keysByName = new Map(navRows.map((row) => [row.category_name, row.group_keys]));
      return keepDistinct(sortedNames, (a, b) =>
        isNearDuplicateByGroupKeys(keysByName.get(a) ?? [], keysByName.get(b) ?? []),
      );
    }

    const head = sortedNames.slice(0, NEAR_DUPLICATE_MAX_CANDIDATES);
    const tail = sortedNames.slice(NEAR_DUPLICATE_MAX_CANDIDATES);
    const pairs: CategoryNamePair[] = head.flatMap((first, i) =>
      head.slice(i + 1).map((second) => ({ first, second })),
    );
    const pairCounts = await this.objectCategoriesRepo.countCategoryPairsByScope({
      scope,
      parentPath: lineage,
      pairs,
    });
    const both = (a: string, b: string) =>
      pairCounts.get(a)?.get(b) ?? pairCounts.get(b)?.get(a) ?? 0;
    const kept = keepDistinct(head, (a, b) =>
      isNearDuplicateByCounts(countOf(a), countOf(b), both(a, b)),
    );
    return [...kept, ...tail];
  }
}

/** Discover type scope without search, tags or map area, at the root. */
function isUnfilteredTypeRoot(input: CategoryNavigationInput): boolean {
  const { scope } = input;
  return (
    input.lineage.length === 0 &&
    scope.kind === 'type' &&
    scope.q.trim().length === 0 &&
    scope.tags.length === 0 &&
    scope.box == null
  );
}

/** Root pair counts from the type scope's `related_counts` (groups shared by two names). */
function precomputedPairCounts(
  navRows: CategoryNavigationRow[],
  pairs: readonly CategoryNamePair[],
): PairCounts {
  const rowByName = new Map(navRows.map((row) => [row.category_name, row]));
  const result: PairCounts = new Map();
  for (const { first, second } of pairs) {
    const row = rowByName.get(first);
    const index = row ? row.related_names.indexOf(second) : -1;
    const shared = row && index >= 0 ? (row.related_counts[index] ?? 0) : 0;
    if (shared > 0) {
      const inner = result.get(first) ?? new Map<string, number>();
      inner.set(second, shared);
      result.set(first, inner);
    }
  }
  return result;
}

/**
 * Names whose drill-down would show at least one child: some grandchild candidate passes the
 * display rules within `lineage + name` (pair count vs the name's own count).
 */
async function findNamesWithChildren(
  navRows: CategoryNavigationRow[],
  lineage: readonly string[],
  names: readonly string[],
  countOf: (name: string) => number,
  pairCountsFor: (pairs: CategoryNamePair[]) => Promise<PairCounts>,
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
  const pairCounts = await pairCountsFor(pairs);
  return new Set(
    pairs
      .filter((pair) =>
        passesCategoryDisplayRules(
          pairCounts.get(pair.first)?.get(pair.second) ?? 0,
          countOf(pair.first),
        ),
      )
      .map((pair) => pair.first),
  );
}

function keepDistinct(
  sortedNames: readonly string[],
  isDuplicate: (a: string, b: string) => boolean,
): string[] {
  const kept: string[] = [];
  for (const name of sortedNames) {
    if (!kept.some((k) => isDuplicate(name, k))) {
      kept.push(name);
    }
  }
  return kept;
}
