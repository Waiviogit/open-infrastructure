import type { UserFavoritesVisibilityFlags } from '@opden-data-layer/core';

import type { CategoryScopeRepository } from './category-scope.repository';
import { CategoryScopeRebuildService } from './category-scope-rebuild.service';

const NO_HIDE: UserFavoritesVisibilityFlags = {
  hide_linked_objects: false,
  hide_recipe_objects: false,
  hide_favorite_objects: false,
};

const OWN_TRX = { kind: 'own-trx' };
const CALLER_TRX = { kind: 'caller-trx' };
const ROWS = [{ category_name: 'Soups' }];

function setup(flags: UserFavoritesVisibilityFlags | null = NO_HIDE) {
  const repository = {
    runInTransaction: jest.fn((work: (trx: unknown) => Promise<unknown>) =>
      work(OWN_TRX),
    ),
    replaceScopeRows: jest.fn().mockResolvedValue(undefined),
    deleteScope: jest.fn().mockResolvedValue(undefined),
    findUserVisibilityFlags: jest.fn().mockResolvedValue(flags),
    findDeselectedObjectIds: jest.fn().mockResolvedValue(['gone']),
    aggregateUserScope: jest.fn().mockResolvedValue(ROWS),
    aggregateTypeScope: jest.fn().mockResolvedValue(ROWS),
    aggregateGlobalScope: jest.fn().mockResolvedValue(ROWS),
  };
  const service = new CategoryScopeRebuildService(
    repository as unknown as CategoryScopeRepository,
  );
  return { service, repository };
}

describe('CategoryScopeRebuildService', () => {
  describe('user scope', () => {
    it('aggregates account:type with the deselected ids and replaces the rows in one transaction', async () => {
      const { service, repository } = setup();

      await expect(service.rebuildUserScope('alice:recipe')).resolves.toBe(
        'rebuilt',
      );

      expect(repository.aggregateUserScope).toHaveBeenCalledWith(
        'alice:recipe',
        {
          account: 'alice',
          objectType: 'recipe',
          includePostObjects: true,
          deselectIds: ['gone'],
        },
        OWN_TRX,
      );
      expect(repository.replaceScopeRows).toHaveBeenCalledWith(
        'user',
        'alice:recipe',
        ROWS,
        OWN_TRX,
      );
      expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['book', { ...NO_HIDE, hide_linked_objects: true }, false],
      ['product', { ...NO_HIDE, hide_linked_objects: true }, false],
      ['recipe', { ...NO_HIDE, hide_linked_objects: true }, true],
      ['recipe', { ...NO_HIDE, hide_recipe_objects: true }, false],
      ['service', { ...NO_HIDE, hide_favorite_objects: true }, false],
      ['service', { ...NO_HIDE, hide_recipe_objects: true }, true],
      ['book', null, true],
    ])(
      'type %s with flags %j → includePostObjects %s',
      async (objectType, flags, expected) => {
        const { service, repository } = setup(flags);

        await service.rebuildUserScope(`alice:${objectType}`);

        expect(repository.aggregateUserScope).toHaveBeenCalledWith(
          `alice:${objectType}`,
          expect.objectContaining({ objectType, includePostObjects: expected }),
          OWN_TRX,
        );
      },
    );

    it.each(['alice', 'alice:book,product', 'alice:place', ':recipe'])(
      'deletes the rows of the legacy key %s without rebuilding it',
      async (scopeKey) => {
        const { service, repository } = setup();

        await expect(service.rebuildUserScope(scopeKey)).resolves.toBe(
          'legacy_deleted',
        );

        expect(repository.deleteScope).toHaveBeenCalledWith(
          'user',
          scopeKey,
          undefined,
        );
        expect(repository.aggregateUserScope).not.toHaveBeenCalled();
        expect(repository.findUserVisibilityFlags).not.toHaveBeenCalled();
      },
    );
  });

  describe('type scope', () => {
    it('rebuilds a category type', async () => {
      const { service, repository } = setup();

      await expect(service.rebuildTypeScope(' product ')).resolves.toBe(
        'rebuilt',
      );

      expect(repository.aggregateTypeScope).toHaveBeenCalledWith(
        'product',
        OWN_TRX,
      );
      expect(repository.replaceScopeRows).toHaveBeenCalledWith(
        'type',
        'product',
        ROWS,
        OWN_TRX,
      );
    });

    it('skips a type without category updates', async () => {
      const { service, repository } = setup();

      await expect(service.rebuildTypeScope('restaurant')).resolves.toBe(
        'not_category_type',
      );

      expect(repository.aggregateTypeScope).not.toHaveBeenCalled();
      expect(repository.replaceScopeRows).not.toHaveBeenCalled();
    });
  });

  it('rebuilds the global scope', async () => {
    const { service, repository } = setup();

    await service.rebuildGlobalScope();

    expect(repository.replaceScopeRows).toHaveBeenCalledWith(
      'global',
      '_',
      ROWS,
      OWN_TRX,
    );
  });

  it("runs inside the caller's transaction when one is passed", async () => {
    const { service, repository } = setup();

    await service.rebuildTypeScope('product', CALLER_TRX as never);
    await service.rebuildUserScope('alice:recipe', CALLER_TRX as never);

    expect(repository.runInTransaction).not.toHaveBeenCalled();
    expect(repository.replaceScopeRows).toHaveBeenCalledWith(
      'type',
      'product',
      ROWS,
      CALLER_TRX,
    );
    expect(repository.findUserVisibilityFlags).toHaveBeenCalledWith(
      'alice',
      CALLER_TRX,
    );
    expect(repository.replaceScopeRows).toHaveBeenCalledWith(
      'user',
      'alice:recipe',
      ROWS,
      CALLER_TRX,
    );
  });
});
