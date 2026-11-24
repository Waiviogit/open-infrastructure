import { GetDiscoverTagCategoriesEndpoint } from './get-discover-tag-categories.endpoint';
import type { DiscoverRepository } from '../../repositories/discover.repository';

const NAVIGATION = { visibleCategoryNames: jest.fn().mockResolvedValue([]) } as never;

describe('GetDiscoverTagCategoriesEndpoint', () => {
  it('maps flat rows into grouped sections', async () => {
    const discoverRepo = {
      getTagCategories: jest.fn().mockResolvedValue([
        { category: 'Pros', tag_value: 'Bitter', object_count: 3 },
        { category: 'Category', tag_value: 'Backpack', object_count: 10 },
      ]),
    } as unknown as DiscoverRepository;

    const endpoint = new GetDiscoverTagCategoriesEndpoint(discoverRepo, NAVIGATION);
    const result = await endpoint.execute({ query: { category_path: [], object_type: 'product', tags: [] } });

    expect(result.categories[0]?.category).toBe('Category');
    expect(result.categories[0]?.items[0]).toEqual({ value: 'Backpack', count: 10 });
    expect(result.categories[1]?.category).toBe('Pros');
  });

  it('passes parsed tag filters to repository', async () => {
    const getTagCategories = jest.fn().mockResolvedValue([]);
    const discoverRepo = { getTagCategories } as unknown as DiscoverRepository;

    const endpoint = new GetDiscoverTagCategoriesEndpoint(discoverRepo, NAVIGATION);
    await endpoint.execute({
      query: { category_path: [], object_type: 'restaurant', tags: ['Cuisine:Asian'] },
    });

    expect(getTagCategories).toHaveBeenCalledWith(
      'restaurant',
      [{ category: 'Cuisine', value: 'Asian' }],
      undefined,
      undefined,
      [],
      [],
    );
  });

  it('passes trimmed q to repository', async () => {
    const getTagCategories = jest.fn().mockResolvedValue([]);
    const discoverRepo = { getTagCategories } as unknown as DiscoverRepository;

    const endpoint = new GetDiscoverTagCategoriesEndpoint(discoverRepo, NAVIGATION);
    await endpoint.execute({
      query: { category_path: [], object_type: 'product', tags: [], q: '  burger  ' },
    });

    expect(getTagCategories).toHaveBeenCalledWith('product', [], 'burger', undefined, [], []);
  });

  it('passes the category lineage to repository', async () => {
    const getTagCategories = jest.fn().mockResolvedValue([]);
    const endpoint = new GetDiscoverTagCategoriesEndpoint({ getTagCategories } as never, NAVIGATION);

    await endpoint.execute({
      query: { category_path: ['Audio', 'Speakers'], object_type: 'product', tags: [] },
    });

    expect(getTagCategories).toHaveBeenCalledWith(
      'product',
      [],
      undefined,
      undefined,
      ['Audio', 'Speakers'],
      [],
    );
  });

  it('narrows the facets to the Other category of the lineage', async () => {
    const getTagCategories = jest.fn().mockResolvedValue([]);
    const navigation = { visibleCategoryNames: jest.fn().mockResolvedValue(['Audio', 'Video']) };
    const endpoint = new GetDiscoverTagCategoriesEndpoint(
      { getTagCategories } as unknown as DiscoverRepository,
      navigation as never,
    );

    await endpoint.execute({
      query: { category_path: ['Electronics'], object_type: 'product', tags: [], other: true },
    });

    expect(navigation.visibleCategoryNames).toHaveBeenCalledWith({
      scope: { kind: 'type', objectType: 'product', q: '', tags: [], box: null },
      objectType: 'product',
      lineage: ['Electronics'],
    });
    expect(getTagCategories).toHaveBeenCalledWith(
      'product',
      [],
      undefined,
      undefined,
      ['Electronics'],
      ['Audio', 'Video'],
    );
  });
});
