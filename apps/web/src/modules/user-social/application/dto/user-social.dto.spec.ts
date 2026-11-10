import { paginatedFollowingObjectsSchema } from './user-social.dto';

describe('paginatedFollowingObjectsSchema', () => {
  it('parses a following-objects page that has no affiliateLinks', () => {
    const parsed = paginatedFollowingObjectsSchema.parse({
      items: [
        {
          object_id: 'obj-1',
          object_type: 'product',
          semantic_type: null,
          fields: { name: 'A thing' },
        },
      ],
      total: 1,
      hasMore: false,
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].object_id).toBe('obj-1');
    expect(parsed.items[0].affiliateLinks).toBeUndefined();
  });

  it('defaults the viewer follow flag to false when the API omits it', () => {
    const parsed = paginatedFollowingObjectsSchema.parse({
      items: [{ object_id: 'obj-1', object_type: 'product', semantic_type: null, fields: {} }],
      total: 1,
      hasMore: false,
    });
    expect(parsed.items[0].isCurrentFollowing).toBe(false);
  });

  it('keeps the viewer follow flag from the API', () => {
    const parsed = paginatedFollowingObjectsSchema.parse({
      items: [
        {
          object_id: 'obj-1',
          object_type: 'product',
          semantic_type: null,
          fields: {},
          isCurrentFollowing: true,
        },
      ],
      total: 1,
      hasMore: false,
    });
    expect(parsed.items[0].isCurrentFollowing).toBe(true);
  });
});
