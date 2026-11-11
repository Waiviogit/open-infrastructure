import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ObjectCategoriesRelatedSyncQueueRepository } from '../../../repositories/object-categories-related-sync-queue.repository';
import { ObjectCategoriesSyncQueueRepository } from '../../../repositories/object-categories-sync-queue.repository';
import {
  CategoryMutatedEvent,
  CATEGORY_MUTATED_EVENT,
} from '../category-mutated.event';
import {
  ObjectActiveStateChangedEvent,
  OBJECT_ACTIVE_STATE_CHANGED_EVENT,
} from '../object-active-state-changed.event';
import {
  ObjectFavoriteChangedEvent,
  OBJECT_FAVORITE_CHANGED_EVENT,
} from '../object-favorite-changed.event';
import {
  UserMetadataChangedEvent,
  USER_METADATA_CHANGED_EVENT,
} from '../../osl-parser/user-metadata-changed.event';
import {
  UserShopDeselectChangedEvent,
  USER_SHOP_DESELECT_CHANGED_EVENT,
} from '../user-shop-deselect-changed.event';
import {
  PostObjectChangedEvent,
  POST_OBJECT_CHANGED_EVENT,
} from '../post-object-changed.event';
import { UserCategoryScopeEnqueueService } from '../user-category-scope-enqueue.service';

const GLOBAL_SCOPE_KEY = '_';

/**
 * Enqueues per-object category recompute and dependent scope aggregation jobs.
 *
 * Category changes enqueue only the object recompute: `ObjectCategoriesWorker` enqueues the
 * global and user scopes after it has written the new `category_names`, so scopes are never
 * rebuilt from stale categories.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
@Injectable()
export class CategorySyncHandler {
  private readonly logger = new Logger(CategorySyncHandler.name);

  constructor(
    private readonly objectCategoriesSyncQueueRepository: ObjectCategoriesSyncQueueRepository,
    private readonly objectCategoriesRelatedSyncQueueRepository: ObjectCategoriesRelatedSyncQueueRepository,
    private readonly userCategoryScopeEnqueueService: UserCategoryScopeEnqueueService,
  ) {}

  private enqueuedAt(): number {
    return Math.floor(Date.now() / 1000);
  }

  @OnEvent(CATEGORY_MUTATED_EVENT)
  async handleCategoryMutated(event: CategoryMutatedEvent): Promise<void> {
    const objectId = event.objectId.trim();
    if (objectId.length === 0) {
      return;
    }
    try {
      await this.objectCategoriesSyncQueueRepository.enqueue(objectId, this.enqueuedAt());
    } catch (error) {
      this.logger.error(
        `category sync enqueue failed for '${objectId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Scopes count only active objects, so an active ↔ inactive flip rebuilds them. */
  @OnEvent(OBJECT_ACTIVE_STATE_CHANGED_EVENT)
  async handleObjectActiveStateChanged(event: ObjectActiveStateChangedEvent): Promise<void> {
    const objectId = event.objectId.trim();
    if (objectId.length === 0) {
      return;
    }
    try {
      const t = this.enqueuedAt();
      await this.objectCategoriesRelatedSyncQueueRepository.enqueue('global', GLOBAL_SCOPE_KEY, t);
      await this.userCategoryScopeEnqueueService.enqueueObjectAudience(
        objectId,
        event.objectType,
        t,
      );
    } catch (error) {
      this.logger.error(
        `category scope enqueue after status change failed for '${objectId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @OnEvent(OBJECT_FAVORITE_CHANGED_EVENT)
  async handleObjectFavoriteChanged(event: ObjectFavoriteChangedEvent): Promise<void> {
    await this.enqueueAccountScopes(event.account);
  }

  @OnEvent(USER_METADATA_CHANGED_EVENT)
  async handleUserMetadataChanged(event: UserMetadataChangedEvent): Promise<void> {
    await this.enqueueAccountScopes(event.account);
  }

  @OnEvent(USER_SHOP_DESELECT_CHANGED_EVENT)
  async handleShopDeselectChanged(event: UserShopDeselectChangedEvent): Promise<void> {
    await this.enqueueAccountScopes(event.account);
  }

  @OnEvent(POST_OBJECT_CHANGED_EVENT)
  async handlePostObjectChanged(event: PostObjectChangedEvent): Promise<void> {
    await this.enqueueAccountScopes(event.postAuthor);
  }

  private async enqueueAccountScopes(account: string): Promise<void> {
    try {
      await this.userCategoryScopeEnqueueService.enqueueAccount(account, this.enqueuedAt());
    } catch (error) {
      this.logger.error(
        `category related scope enqueue failed for '${account}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
