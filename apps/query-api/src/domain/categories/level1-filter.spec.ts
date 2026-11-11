import { greedyRootDepartments } from './level1-filter';
import type { CategoryNavigationRow } from './category-navigation.types';

function row(
  name: string,
  objectsCount: number,
  related: string[],
): CategoryNavigationRow {
  return {
    category_name: name,
    objects_count: objectsCount,
    group_keys: [],
    related_names: related,
  };
}

describe('greedyRootDepartments', () => {
  it('dedupes narrower names dominated by related set of earlier heavy row', () => {
    const items = greedyRootDepartments([
      row('Electronics', 100, ['Audio', 'Headphones']),
      row('Headphones', 50, ['Electronics']),
    ]);
    expect(items.map((i) => i.category_name)).toEqual(['Electronics']);
  });

  it('orders by precomputed count and does not cap (caller caps after live counts)', () => {
    const many: CategoryNavigationRow[] = [];
    for (let i = 0; i < 25; i++) {
      many.push(row(`Cat${i}`, i, []));
    }
    const items = greedyRootDepartments(many);
    expect(items).toHaveLength(25);
    expect(items[0]?.category_name).toBe('Cat24');
  });
});
