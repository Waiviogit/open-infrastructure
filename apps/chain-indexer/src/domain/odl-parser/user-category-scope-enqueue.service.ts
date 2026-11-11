import { Injectable } from '@nestjs/common';
import {
  buildUserCategoryScopeKey,
  CATEGORY_OBJECT_TYPES,
  objectTypeSupportsCategories,
} from '@opden-data-layer/core';
import { ObjectCategoriesRelatedSyncQueueRepository } from '../../repositories/object-categories-related-sync-queue.repository';
import { ObjectFavoriteRepository } from '../../repositories/object-favorite.repository';
import { PostsRepository } from '../../repositories/posts.repository';

/**
 * Resolves and enqueues rebuilds of per-type user category scopes (`account:objectType`) in
 * `object_categories_related_sync_queue`. Errors propagate to the caller.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
@Injectable()
export class UserCategoryScopeEnqueueService {
  constructor(
    private readonly relatedSyncQueueRepository: ObjectCategoriesRelatedSyncQueueRepository,
    private readonly objectFavoriteRepository: ObjectFavoriteRepository,
    private readonly postsRepository: PostsRepository,
  ) {}

  /** Every category type scope of one account (favorites / metadata / deselect / posts changed). */
  async enqueueAccount(accountRaw: string, enqueuedAt: number): Promise<void> {
    const account = accountRaw.trim();
    if (account.length === 0) {
      return;
    }
    const keys = CATEGORY_OBJECT_TYPES.map((type) => buildUserCategoryScopeKey(account, type));
    await this.relatedSyncQueueRepository.enqueueMany('user', keys, enqueuedAt);
  }

  /** Enqueues {@link objectAudienceScopeKeys} in one insert. */
  async enqueueObjectAudience(
    objectId: string,
    objectType: string,
    enqueuedAt: number,
  ): Promise<void> {
    const keys = await this.objectAudienceScopeKeys(objectId, objectType);
    await this.relatedSyncQueueRepository.enqueueMany('user', keys, enqueuedAt);
  }

  /**
   * The `(account, objectType)` scope keys of every account whose Favorites can contain this
   * object: its favoriters and the authors of posts linking it. Empty when the type has no
   * category navigation.
   */
  async objectAudienceScopeKeys(objectIdRaw: string, objectType: string): Promise<string[]> {
    const objectId = objectIdRaw.trim();
    if (objectId.length === 0 || !objectTypeSupportsCategories(objectType)) {
      return [];
    }
    const [favorites, postAuthors] = await Promise.all([
      this.objectFavoriteRepository.findByObjectId(objectId),
      this.postsRepository.findDistinctAuthorsByLinkedObject(objectId),
    ]);
    const accounts = new Set<string>();
    for (const row of favorites) {
      accounts.add(row.account.trim());
    }
    for (const author of postAuthors) {
      accounts.add(author.trim());
    }
    accounts.delete('');
    return [...accounts].map((account) => buildUserCategoryScopeKey(account, objectType));
  }
}
