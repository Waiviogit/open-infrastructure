import { userCategoriesQuerySchema } from './categories-query.schema';

describe('userCategoriesQuerySchema: types', () => {
  it('accepts exactly one category type', () => {
    const parsed = userCategoriesQuerySchema.safeParse({ types: 'recipe' });
    expect(parsed.success && parsed.data.types).toEqual(['recipe']);
    expect(userCategoriesQuerySchema.safeParse({ types: ['book'] }).success).toBe(true);
  });

  it('rejects a missing types param (no book/product default)', () => {
    expect(userCategoriesQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects several types, even when each supports categories', () => {
    expect(userCategoriesQuerySchema.safeParse({ types: ['book', 'product'] }).success).toBe(false);
  });

  it('rejects a type without the category update', () => {
    expect(userCategoriesQuerySchema.safeParse({ types: 'restaurant' }).success).toBe(false);
  });
});
