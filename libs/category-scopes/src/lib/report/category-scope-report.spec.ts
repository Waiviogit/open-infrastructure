import {
  TYPE_SCOPE_TOTAL_SENTINEL,
  UNCATEGORIZED_CATEGORY_SENTINEL,
} from '@opden-data-layer/core';
import type {
  ObjectCategoriesRelatedRow,
  ObjectCategoriesRelatedScopeType,
} from '@opden-data-layer/odl-db-types';

import {
  diffCategoryScopes,
  hasCategoryScopeChanges,
} from './category-scope-diff';
import { snapshotCategoryScope } from './category-scope-snapshot';

function row(
  scopeType: ObjectCategoriesRelatedScopeType,
  name: string,
  count: number,
  opts: { groupKeys?: string[]; related?: string[] } = {},
): ObjectCategoriesRelatedRow {
  return {
    scope_type: scopeType,
    scope_key: scopeType === 'user' ? 'alice:product' : 'product',
    category_name: name,
    objects_count: count,
    group_keys: opts.groupKeys ?? [],
    related_names: opts.related ?? [],
    related_counts: [],
  } as unknown as ObjectCategoriesRelatedRow;
}

const keys = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('snapshotCategoryScope', () => {
  it('type scope: total from __total__, root after the display rules', () => {
    const snapshot = snapshotCategoryScope([
      row('type', 'Everything', 90),
      row('type', 'Audio', 20),
      row('type', 'Video', 12),
      row('type', 'Tiny', 2),
      row('type', TYPE_SCOPE_TOTAL_SENTINEL, 100),
    ]);

    expect(snapshot.total).toBe(100);
    expect(snapshot.stored.map((c) => c.name)).toEqual([
      'Everything',
      'Audio',
      'Video',
      'Tiny',
    ]);
    // Everything covers 90% (> 60%), Tiny has fewer than 3 groups.
    expect(snapshot.visibleRoot).toEqual([
      { name: 'Audio', count: 20 },
      { name: 'Video', count: 12 },
    ]);
    expect(snapshot.showOther).toBe(false);
  });

  it('user scope: total = groups of every category plus uncategorized', () => {
    const snapshot = snapshotCategoryScope([
      row('user', 'Audio', 4, { groupKeys: keys('a', 4) }),
      row('user', 'Video', 3, { groupKeys: [...keys('v', 2), 'a0'] }),
      row('user', UNCATEGORIZED_CATEGORY_SENTINEL, 3),
    ]);

    expect(snapshot.total).toBe(9);
    expect(snapshot.visibleRoot.map((c) => c.name)).toEqual(['Audio', 'Video']);
  });

  it('global scope has no total and no visible root', () => {
    const snapshot = snapshotCategoryScope([row('global', 'Audio', 5)]);

    expect(snapshot.total).toBeNull();
    expect(snapshot.visibleRoot).toEqual([]);
  });
});

describe('diffCategoryScopes', () => {
  it('reports appeared, disappeared and recounted categories, stored and visible', () => {
    const before = snapshotCategoryScope([
      row('type', 'Audio', 20),
      row('type', 'Video', 12),
      row('type', 'Old', 5),
      row('type', TYPE_SCOPE_TOTAL_SENTINEL, 100),
    ]);
    const after = snapshotCategoryScope([
      row('type', 'Audio', 70),
      row('type', 'Video', 12),
      row('type', 'New', 4),
      row('type', TYPE_SCOPE_TOTAL_SENTINEL, 100),
    ]);

    const diff = diffCategoryScopes(before, after);

    expect(diff.storedAdded).toEqual([{ name: 'New', count: 4 }]);
    expect(diff.storedRemoved).toEqual([{ name: 'Old', count: 5 }]);
    expect(diff.countChanged).toEqual([
      { name: 'Audio', before: 20, after: 70 },
    ]);
    // Audio grew past 60% and is hidden now.
    expect(diff.visibleAdded).toEqual([{ name: 'New', count: 4 }]);
    expect(diff.visibleRemoved).toEqual([
      { name: 'Audio', count: 20 },
      { name: 'Old', count: 5 },
    ]);
    expect(hasCategoryScopeChanges(diff)).toBe(true);
  });

  it('an identical rebuild has no changes', () => {
    const rows = [
      row('type', 'Audio', 20),
      row('type', TYPE_SCOPE_TOTAL_SENTINEL, 100),
    ];

    expect(
      hasCategoryScopeChanges(
        diffCategoryScopes(
          snapshotCategoryScope(rows),
          snapshotCategoryScope(rows),
        ),
      ),
    ).toBe(false);
  });
});
