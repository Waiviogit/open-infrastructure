import { encodeWeightObjectCursor } from '../pagination/weight-object-cursor';
import {
  shopFiltersQuerySchema,
  shopObjectsQuerySchema,
  shopSectionsQuerySchema,
} from './shop.schema';

describe('shop query schemas: types', () => {
  const schemas = [
    ['shop-objects', shopObjectsQuerySchema],
    ['shop-sections', shopSectionsQuerySchema],
    ['shop/filters', shopFiltersQuerySchema],
  ] as const;

  it.each(schemas)('%s accepts Favorites types (single or repeated)', (_, schema) => {
    expect(schema.safeParse({ types: 'restaurant' }).success).toBe(true);
    const parsed = schema.safeParse({ types: ['book', 'product'] });
    expect(parsed.success && parsed.data.types).toEqual(['book', 'product']);
  });

  it.each(schemas)('%s rejects a type outside USER_FAVORITES_OBJECT_TYPES', (_, schema) => {
    expect(schema.safeParse({ types: ['recipe', 'hashtag'] }).success).toBe(false);
    expect(schema.safeParse({ types: 'governance' }).success).toBe(false);
    expect(schema.safeParse({ types: 'not-a-type' }).success).toBe(false);
  });

  it.each(schemas)('%s requires types (no implicit book/product default)', (_, schema) => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ types: '' }).success).toBe(false);
  });
});

describe('shopObjectsQuerySchema: cursor', () => {
  it('accepts an opaque weight + object_id cursor', () => {
    const cursor = encodeWeightObjectCursor({ weight: 3, object_id: 'a' });
    expect(shopObjectsQuerySchema.safeParse({ types: 'recipe', cursor }).success).toBe(true);
  });

  it('rejects a malformed or legacy object_id cursor', () => {
    expect(shopObjectsQuerySchema.safeParse({ types: 'recipe', cursor: 'obj-1' }).success).toBe(false);
  });
});
