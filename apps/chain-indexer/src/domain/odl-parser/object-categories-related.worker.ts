import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ObjectCategoriesRelatedSyncQueueRow } from '@opden-data-layer/odl-db-types';

import { CategoryScopeRebuildService } from '@opden-data-layer/category-scopes';
import { CATEGORY_OBJECT_TYPES } from '@opden-data-layer/core';
import { ObjectCategoriesRelatedSyncQueueRepository } from '../../repositories/object-categories-related-sync-queue.repository';
import { CategoryTypeScopeThrottleService } from './category-type-scope-throttle.service';
import {
  OBJECT_CATEGORIES_RELATED_WORKER_BATCH_SIZE,
  OBJECT_CATEGORIES_RELATED_WORKER_INTERVAL_NAME,
  OBJECT_CATEGORIES_RETRY_AFTER_SEC,
} from '../../constants/object-categories.constants';

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * Drains `object_categories_related_sync_queue`: rebuilds the global scope, one type scope
 * (all active objects of a category type, rate limited) or one per-type user scope
 * (`account:objectType`). The rebuild itself is `CategoryScopeRebuildService`
 * (`@opden-data-layer/category-scopes`), shared with the `categories:rebuild` script.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
@Injectable()
export class ObjectCategoriesRelatedWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectCategoriesRelatedWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly relatedSyncQueueRepository: ObjectCategoriesRelatedSyncQueueRepository,
    private readonly scopeRebuild: CategoryScopeRebuildService,
    private readonly typeScopeThrottle: CategoryTypeScopeThrottleService,
  ) {}

  onModuleInit(): void {
    const raw = this.configService.get<number>(
      'objectCategoriesRelated.intervalMs',
      DEFAULT_INTERVAL_MS,
    );
    const intervalMs = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
    const id = setInterval(() => {
      void this.runBatch();
    }, intervalMs);
    this.schedulerRegistry.addInterval(OBJECT_CATEGORIES_RELATED_WORKER_INTERVAL_NAME, id);
  }

  onModuleDestroy(): void {
    try {
      this.schedulerRegistry.deleteInterval(OBJECT_CATEGORIES_RELATED_WORKER_INTERVAL_NAME);
    } catch {
      // ignore
    }
  }

  async runBatch(): Promise<void> {
    const batchSize = this.configService.get<number>(
      'objectCategoriesRelated.batchSize',
      OBJECT_CATEGORIES_RELATED_WORKER_BATCH_SIZE,
    );
    const maxAttempts = this.configService.get<number>(
      'objectCategoriesRelated.maxAttempts',
      DEFAULT_MAX_ATTEMPTS,
    );
    const limit = batchSize > 0 ? batchSize : OBJECT_CATEGORIES_RELATED_WORKER_BATCH_SIZE;

    const throttledTypes = await this.typeScopeThrottle.throttledTypes(CATEGORY_OBJECT_TYPES);
    const tasks = await this.relatedSyncQueueRepository.claimBatch(
      limit,
      OBJECT_CATEGORIES_RETRY_AFTER_SEC,
      throttledTypes,
    );

    for (const task of tasks) {
      await this.processTask(task, maxAttempts);
    }
  }

  private async processTask(
    task: ObjectCategoriesRelatedSyncQueueRow,
    maxAttempts: number,
  ): Promise<void> {
    try {
      if (task.scope_type === 'global') {
        await this.scopeRebuild.rebuildGlobalScope();
      } else if (task.scope_type === 'type') {
        await this.rebuildTypeScope(task.scope_key);
      } else {
        await this.rebuildUserScope(task.scope_key);
      }
      await this.finishTask(task);
    } catch (error: unknown) {
      this.logger.error(
        `object_categories_related scope '${task.scope_type}/${task.scope_key}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (task.attempts >= maxAttempts) {
        await this.finishTask(task);
      } else {
        await this.relatedSyncQueueRepository.resetAttempt(task.scope_type, task.scope_key);
      }
    }
  }

  private async rebuildTypeScope(objectType: string): Promise<void> {
    const outcome = await this.scopeRebuild.rebuildTypeScope(objectType);
    if (outcome === 'not_category_type') {
      this.logger.warn(`object_categories_related: '${objectType}' is not a category type; skipped`);
      return;
    }
    await this.typeScopeThrottle.markRebuilt(objectType);
  }

  private async rebuildUserScope(scopeKey: string): Promise<void> {
    const outcome = await this.scopeRebuild.rebuildUserScope(scopeKey);
    if (outcome === 'legacy_deleted') {
      this.logger.warn(
        `object_categories_related: legacy or non-category user scope '${scopeKey}'; rows deleted`,
      );
    }
  }

  /**
   * Removes the claimed queue row unless it was re-enqueued while being processed; a re-enqueued
   * row is released for the next batch instead.
   */
  private async finishTask(task: ObjectCategoriesRelatedSyncQueueRow): Promise<void> {
    const removed = await this.relatedSyncQueueRepository.deleteClaimed(
      task.scope_type,
      task.scope_key,
      task.enqueued_at,
    );
    if (!removed) {
      await this.relatedSyncQueueRepository.resetAttempt(task.scope_type, task.scope_key);
    }
  }
}
