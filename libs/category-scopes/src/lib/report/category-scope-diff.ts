import type {
  CategoryCount,
  CategoryScopeSnapshot,
} from './category-scope-snapshot';

export type CategoryCountChange = {
  name: string;
  before: number;
  after: number;
};

/** What changed in one scope between two snapshots (e.g. before and after a rebuild). */
export type CategoryScopeDiff = {
  totalBefore: number | null;
  totalAfter: number | null;
  /** Root categories a client now sees and did not before. */
  visibleAdded: CategoryCount[];
  /** Root categories a client no longer sees. */
  visibleRemoved: CategoryCount[];
  /** Stored categories that appeared / disappeared. */
  storedAdded: CategoryCount[];
  storedRemoved: CategoryCount[];
  /** Stored categories present in both with another count. */
  countChanged: CategoryCountChange[];
};

export function diffCategoryScopes(
  before: CategoryScopeSnapshot,
  after: CategoryScopeSnapshot,
): CategoryScopeDiff {
  const storedBefore = toCountMap(before.stored);
  const storedAfter = toCountMap(after.stored);
  return {
    totalBefore: before.total,
    totalAfter: after.total,
    visibleAdded: missingFrom(
      after.visibleRoot,
      toCountMap(before.visibleRoot),
    ),
    visibleRemoved: missingFrom(
      before.visibleRoot,
      toCountMap(after.visibleRoot),
    ),
    storedAdded: missingFrom(after.stored, storedBefore),
    storedRemoved: missingFrom(before.stored, storedAfter),
    countChanged: after.stored.flatMap((c) => {
      const previous = storedBefore.get(c.name);
      return previous != null && previous !== c.count
        ? [{ name: c.name, before: previous, after: c.count }]
        : [];
    }),
  };
}

/** True when the diff has any change (counts, stored names, the visible root or the total). */
export function hasCategoryScopeChanges(diff: CategoryScopeDiff): boolean {
  return (
    diff.totalBefore !== diff.totalAfter ||
    diff.visibleAdded.length > 0 ||
    diff.visibleRemoved.length > 0 ||
    diff.storedAdded.length > 0 ||
    diff.storedRemoved.length > 0 ||
    diff.countChanged.length > 0
  );
}

function toCountMap(counts: readonly CategoryCount[]): Map<string, number> {
  return new Map(counts.map((c) => [c.name, c.count]));
}

function missingFrom(
  counts: readonly CategoryCount[],
  other: Map<string, number>,
): CategoryCount[] {
  return counts.filter((c) => !other.has(c.name));
}
