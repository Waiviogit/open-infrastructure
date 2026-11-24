import { discoverSectionsQuerySchema, type DiscoverSectionsQuery } from './discover-query.schema';
import { GetDiscoverSectionsEndpoint } from './get-discover-sections.endpoint';

const NAV_ITEMS = [
  { name: 'Audio', objects_count: 20, has_children: true },
  { name: 'Video', objects_count: 12, has_children: false },
  { name: 'Headphones', objects_count: 5, has_children: false },
];

const IDS: Record<string, string[]> = {
  Audio: ['a1', 'a2', 'a3'],
  Video: ['v1', 'shared'],
  Headphones: ['shared', 'h2'],
};

function setup() {
  const navigation = { build: jest.fn().mockResolvedValue({ items: NAV_ITEMS, show_other: false }) };
  const discoverRepo = {
    listObjects: jest.fn().mockImplementation(async ({ categoryPath }: { categoryPath: string[] }) => ({
      rows: (IDS[categoryPath[categoryPath.length - 1] ?? ''] ?? []).map((object_id) => ({
        object_id,
        created_at: new Date(),
        weight: 1,
      })),
      hasMore: false,
    })),
  };
  const projector = {
    project: jest
      .fn()
      .mockImplementation(async (ids: string[]) => ids.map((object_id) => ({ object_id }))),
  };
  const endpoint = new GetDiscoverSectionsEndpoint(
    navigation as never,
    discoverRepo as never,
    projector as never,
  );
  return { endpoint, navigation, discoverRepo, projector };
}

const query = (overrides: Partial<DiscoverSectionsQuery> = {}): DiscoverSectionsQuery => ({
  object_type: 'product',
  category_path: ['Electronics'],
  section_limit: 2,
  ...overrides,
});

describe('GetDiscoverSectionsEndpoint', () => {
  it('builds blocks from the unfiltered type tree with top objects by rank per child', async () => {
    const { endpoint, navigation, discoverRepo, projector } = setup();

    const result = await endpoint.execute({ query: query(), locale: 'en-US' });

    expect(navigation.build).toHaveBeenCalledWith({
      scope: { kind: 'type', objectType: 'product', q: '', tags: [], box: null },
      objectType: 'product',
      lineage: ['Electronics'],
      excluded: [],
      includeHasChildren: false,
    });
    expect(discoverRepo.listObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: 'product',
        sort: 'rank',
        limit: 3,
        categoryPath: ['Electronics', 'Audio'],
      }),
    );
    expect(projector.project).toHaveBeenCalledWith(['a1', 'a2', 'a3', 'v1', 'shared'], expect.anything());
    expect(result).toEqual({
      sections: [
        {
          categoryName: 'Audio',
          totalObjects: 20,
          items: [{ object_id: 'a1' }, { object_id: 'a2' }, { object_id: 'a3' }],
        },
        { categoryName: 'Video', totalObjects: 12, items: [{ object_id: 'v1' }, { object_id: 'shared' }] },
      ],
      cursor: 'Video',
      hasMore: true,
    });
  });

  it('continues after the cursor category and projects shared objects once', async () => {
    const { endpoint } = setup();

    const result = await endpoint.execute({ query: query({ cursor: 'Video' }), locale: 'en-US' });

    expect(result.sections.map((section) => section.categoryName)).toEqual(['Headphones']);
    expect(result.sections[0]?.items).toEqual([{ object_id: 'shared' }, { object_id: 'h2' }]);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeNull();
  });

  it('returns no blocks for an unknown cursor', async () => {
    const { endpoint, discoverRepo } = setup();

    const result = await endpoint.execute({ query: query({ cursor: 'Missing' }), locale: 'en-US' });

    expect(result).toEqual({ sections: [], cursor: null, hasMore: false });
    expect(discoverRepo.listObjects).not.toHaveBeenCalled();
  });
});

describe('discoverSectionsQuerySchema', () => {
  it('requires a category type and a non-empty lineage', () => {
    expect(
      discoverSectionsQuerySchema.safeParse({ object_type: 'product', category_path: ['A'] }).success,
    ).toBe(true);
    expect(discoverSectionsQuerySchema.safeParse({ object_type: 'product' }).success).toBe(false);
    expect(
      discoverSectionsQuerySchema.safeParse({ object_type: 'restaurant', category_path: ['A'] })
        .success,
    ).toBe(false);
  });
});
