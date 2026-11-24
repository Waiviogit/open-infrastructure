import {
  DISCOVER_POPULAR_OBJECT_TYPES,
  discoverMoreTypeTab,
  getRatingDimensionNamesForObjectType,
  getTagCategoryNamesForObjectType,
  listDiscoverMoreObjectTypes,
  listDiscoverObjectTypes,
  listDiscoverPopularObjectTypes,
  matchesDiscoverTypeSearch,
  objectTypeHasTagCategoryFilters,
  objectTypeSupportsGeo,
} from './discover-registry';

describe('discover-registry', () => {
  it('lists object types from registry', () => {
    const types = listDiscoverObjectTypes();
    expect(types).toContain('product');
    expect(types.length).toBeGreaterThan(10);
  });

  it('lists popular types in menu order', () => {
    expect(listDiscoverPopularObjectTypes()).toEqual([...DISCOVER_POPULAR_OBJECT_TYPES]);
  });

  it('lists every other registry type under More, sorted', () => {
    const more = listDiscoverMoreObjectTypes();
    for (const popular of DISCOVER_POPULAR_OBJECT_TYPES) {
      expect(more).not.toContain(popular);
    }
    expect(more).toContain('recipe');
    expect(more.length + DISCOVER_POPULAR_OBJECT_TYPES.length).toBe(
      listDiscoverObjectTypes().length,
    );
    expect(more).toEqual([...more].sort((a, b) => a.localeCompare(b)));
  });

  it('shows a More type as an extra tab only when it is active', () => {
    expect(discoverMoreTypeTab('recipe', false)).toBe('recipe');
    expect(discoverMoreTypeTab('product', false)).toBeNull();
    expect(discoverMoreTypeTab('all', false)).toBeNull();
    expect(discoverMoreTypeTab('not-a-type', false)).toBeNull();
    expect(discoverMoreTypeTab(null, false)).toBeNull();
    expect(discoverMoreTypeTab('recipe', true)).toBeNull();
  });

  it('matches type search against key and spaced label', () => {
    expect(matchesDiscoverTypeSearch('service_offer', 'offer')).toBe(true);
    expect(matchesDiscoverTypeSearch('service_offer', 'offered')).toBe(false);
    expect(matchesDiscoverTypeSearch('restaurant', 'prod')).toBe(false);
    expect(matchesDiscoverTypeSearch('product', '')).toBe(true);
  });

  it('product has tag category filters', () => {
    expect(objectTypeHasTagCategoryFilters('product')).toBe(true);
    expect(getTagCategoryNamesForObjectType('product')).toEqual([
      'Category',
      'Pros',
      'Cons',
    ]);
  });

  it('hashtag has no tag category filters', () => {
    expect(objectTypeHasTagCategoryFilters('hashtag')).toBe(false);
  });

  it('returns false for null, all, and unknown types', () => {
    expect(objectTypeHasTagCategoryFilters(null)).toBe(false);
    expect(objectTypeHasTagCategoryFilters('all')).toBe(false);
    expect(objectTypeHasTagCategoryFilters('not-a-type')).toBe(false);
  });

  it('restaurant has tag category filters', () => {
    expect(objectTypeHasTagCategoryFilters('restaurant')).toBe(true);
  });

  it('product has rating dimensions from supposed_updates', () => {
    expect(getRatingDimensionNamesForObjectType('product')).toEqual(['Quality', 'Value']);
  });

  it('unknown type has no rating dimensions', () => {
    expect(getRatingDimensionNamesForObjectType('not-a-type')).toEqual([]);
  });

  it('hashtag has no rating dimensions in supposed_updates', () => {
    expect(getRatingDimensionNamesForObjectType('hashtag')).toEqual([]);
  });

  it('reports geo support for registry types with geo update', () => {
    for (const type of ['restaurant', 'place', 'business', 'person', 'service'] as const) {
      expect(objectTypeSupportsGeo(type)).toBe(true);
    }
  });

  it('withholds geo support from non-geo types, all, and null', () => {
    expect(objectTypeSupportsGeo('book')).toBe(false);
    expect(objectTypeSupportsGeo('all')).toBe(false);
    expect(objectTypeSupportsGeo(null)).toBe(false);
  });
});
