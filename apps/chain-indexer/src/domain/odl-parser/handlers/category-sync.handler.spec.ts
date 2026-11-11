import { CATEGORY_OBJECT_TYPES } from '@opden-data-layer/core';
import { CategorySyncHandler } from './category-sync.handler';
import { CategoryMutatedEvent } from '../category-mutated.event';
import { ObjectActiveStateChangedEvent } from '../object-active-state-changed.event';
import { ObjectFavoriteChangedEvent } from '../object-favorite-changed.event';
import { PostObjectChangedEvent } from '../post-object-changed.event';
import { UserCategoryScopeEnqueueService } from '../user-category-scope-enqueue.service';

type Mocks = {
  objectEnqueue: jest.Mock;
  relatedEnqueue: jest.Mock;
  relatedEnqueueMany: jest.Mock;
  favoritesByObject: jest.Mock;
  postAuthorsByObject: jest.Mock;
};

function setup(audience: { favoriters?: string[]; postAuthors?: string[] } = {}) {
  const mocks: Mocks = {
    objectEnqueue: jest.fn().mockResolvedValue(undefined),
    relatedEnqueue: jest.fn().mockResolvedValue(undefined),
    relatedEnqueueMany: jest.fn().mockResolvedValue(undefined),
    favoritesByObject: jest
      .fn()
      .mockResolvedValue((audience.favoriters ?? []).map((account) => ({ account }))),
    postAuthorsByObject: jest.fn().mockResolvedValue(audience.postAuthors ?? []),
  };
  const relatedQueue = { enqueue: mocks.relatedEnqueue, enqueueMany: mocks.relatedEnqueueMany };
  const scopes = new UserCategoryScopeEnqueueService(
    relatedQueue as never,
    { findByObjectId: mocks.favoritesByObject } as never,
    { findDistinctAuthorsByLinkedObject: mocks.postAuthorsByObject } as never,
  );
  const handler = new CategorySyncHandler(
    { enqueue: mocks.objectEnqueue } as never,
    relatedQueue as never,
    scopes,
  );
  return { handler, mocks };
}

/** Every user scope key passed to `enqueueMany('user', …)`, across calls. */
function enqueuedUserKeys(enqueueMany: jest.Mock): string[] {
  return enqueueMany.mock.calls
    .filter(([scopeType]) => scopeType === 'user')
    .flatMap(([, keys]) => keys as string[])
    .sort();
}

describe('CategorySyncHandler', () => {
  describe('category mutated', () => {
    it('enqueues only the object recompute; scopes wait for the recomputed categories', async () => {
      const { handler, mocks } = setup({ favoriters: ['shop'], postAuthors: ['poster'] });

      await handler.handleCategoryMutated(new CategoryMutatedEvent(' o1 '));

      expect(mocks.objectEnqueue).toHaveBeenCalledWith('o1', expect.any(Number));
      expect(mocks.relatedEnqueue).not.toHaveBeenCalled();
      expect(mocks.relatedEnqueueMany).not.toHaveBeenCalled();
    });

    it('ignores a blank object id', async () => {
      const { handler, mocks } = setup();

      await handler.handleCategoryMutated(new CategoryMutatedEvent('  '));

      expect(mocks.objectEnqueue).not.toHaveBeenCalled();
    });

    it('swallows a queue failure so the event bus is not broken', async () => {
      const { handler, mocks } = setup();
      mocks.objectEnqueue.mockRejectedValue(new Error('db down'));

      await expect(
        handler.handleCategoryMutated(new CategoryMutatedEvent('o1')),
      ).resolves.toBeUndefined();
    });
  });

  describe('account events', () => {
    it('enqueues one scope per category type for the account in a single insert', async () => {
      const { handler, mocks } = setup();

      await handler.handleObjectFavoriteChanged(new ObjectFavoriteChangedEvent(' merchant '));

      expect(mocks.relatedEnqueueMany).toHaveBeenCalledTimes(1);
      expect(mocks.relatedEnqueueMany).toHaveBeenCalledWith(
        'user',
        CATEGORY_OBJECT_TYPES.map((type) => `merchant:${type}`),
        expect.any(Number),
      );
      expect(enqueuedUserKeys(mocks.relatedEnqueueMany)).toEqual(
        expect.arrayContaining(['merchant:book', 'merchant:product', 'merchant:recipe']),
      );
      expect(mocks.objectEnqueue).not.toHaveBeenCalled();
    });

    it('enqueues the post author scopes on a post object change', async () => {
      const { handler, mocks } = setup();

      await handler.handlePostObjectChanged(new PostObjectChangedEvent('writer'));

      expect(enqueuedUserKeys(mocks.relatedEnqueueMany)).toContain('writer:recipe');
    });

    it('does nothing for a blank account', async () => {
      const { handler, mocks } = setup();

      await handler.handleObjectFavoriteChanged(new ObjectFavoriteChangedEvent('  '));

      expect(mocks.relatedEnqueueMany).not.toHaveBeenCalled();
    });

    it('never enqueues a legacy multi-type or bare-account key', async () => {
      const { handler, mocks } = setup();

      await handler.handleObjectFavoriteChanged(new ObjectFavoriteChangedEvent('merchant'));

      for (const key of enqueuedUserKeys(mocks.relatedEnqueueMany)) {
        expect(key).toMatch(/^merchant:[a-z_]+$/);
      }
    });
  });

  describe('object active state changed', () => {
    it('enqueues global + the (account, type) scope of favoriters and post authors for a category type', async () => {
      const { handler, mocks } = setup({
        favoriters: ['fan', 'both'],
        postAuthors: ['writer', 'both'],
      });

      await handler.handleObjectActiveStateChanged(
        new ObjectActiveStateChangedEvent('o1', 'recipe', false),
      );

      expect(mocks.relatedEnqueue).toHaveBeenCalledWith('global', '_', expect.any(Number));
      expect(enqueuedUserKeys(mocks.relatedEnqueueMany)).toEqual([
        'both:recipe',
        'fan:recipe',
        'writer:recipe',
      ]);
    });

    it('enqueues only the global scope for a type without categories', async () => {
      const { handler, mocks } = setup({ favoriters: ['fan'] });

      await handler.handleObjectActiveStateChanged(
        new ObjectActiveStateChangedEvent('o1', 'place', true),
      );

      expect(mocks.relatedEnqueue).toHaveBeenCalledWith('global', '_', expect.any(Number));
      expect(enqueuedUserKeys(mocks.relatedEnqueueMany)).toEqual([]);
      expect(mocks.favoritesByObject).not.toHaveBeenCalled();
    });
  });
});
