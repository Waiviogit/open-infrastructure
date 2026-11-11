import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { Kysely } from 'kysely';
import { UPDATE_TYPES } from '@opden-data-layer/core';
import type { ObjectCategoriesSyncQueueRow } from '@opden-data-layer/odl-db-types';
import { ObjectViewService } from '@opden-data-layer/objects-domain';
import { AggregatedObjectRepository } from '../../repositories/aggregated-object.repository';
import { ObjectCategoriesRepository } from '../../repositories/object-categories.repository';
import { ObjectCategoriesSyncQueueRepository } from '../../repositories/object-categories-sync-queue.repository';
import { ObjectCategoriesRelatedSyncQueueRepository } from '../../repositories/object-categories-related-sync-queue.repository';
import { KYSELY, type Database } from '../../database';
import { GovernanceCacheService } from '../governance/governance-cache.service';
import { UserCategoryScopeEnqueueService } from './user-category-scope-enqueue.service';
import {
  MAX_CATEGORIES_PER_OBJECT,
  OBJECT_CATEGORIES_RETRY_AFTER_SEC,
  OBJECT_CATEGORIES_WORKER_BATCH_SIZE,
  OBJECT_CATEGORIES_WORKER_INTERVAL_NAME,
} from '../../constants/object-categories.constants';

const DEFAULT_INTERVAL_MS = 3_000;
const DEFAULT_MAX_ATTEMPTS = 10;
const GLOBAL_SCOPE_KEY = '_';

/** Same set of names regardless of order (aggregation treats `category_names` as a set). */
function sameCategoryNames(previous: readonly string[], next: readonly string[]): boolean {
  const a = new Set(previous);
  const b = new Set(next);
  return a.size === b.size && [...a].every((name) => b.has(name));
}

@Injectable()
export class ObjectCategoriesWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectCategoriesWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly objectCategoriesSyncQueueRepository: ObjectCategoriesSyncQueueRepository,
    private readonly aggregatedObjectRepository: AggregatedObjectRepository,
    private readonly governanceCacheService: GovernanceCacheService,
    private readonly objectViewService: ObjectViewService,
    private readonly objectCategoriesRepository: ObjectCategoriesRepository,
    private readonly relatedSyncQueueRepository: ObjectCategoriesRelatedSyncQueueRepository,
    private readonly userCategoryScopeEnqueueService: UserCategoryScopeEnqueueService,
    @Inject(KYSELY) private readonly db: Kysely<Database>,
  ) {}

  onModuleInit(): void {
    const raw = this.configService.get<number>('objectCategories.intervalMs', DEFAULT_INTERVAL_MS);
    const intervalMs = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
    const id = setInterval(() => {
      void this.runBatch();
    }, intervalMs);
    this.schedulerRegistry.addInterval(OBJECT_CATEGORIES_WORKER_INTERVAL_NAME, id);
  }

  onModuleDestroy(): void {
    try {
      this.schedulerRegistry.deleteInterval(OBJECT_CATEGORIES_WORKER_INTERVAL_NAME);
    } catch {
      // Tests may omit ScheduleModule.
    }
  }

  async runBatch(): Promise<void> {
    const batchSize = this.configService.get<number>(
      'objectCategories.batchSize',
      OBJECT_CATEGORIES_WORKER_BATCH_SIZE,
    );
    const maxAttempts = this.configService.get<number>(
      'objectCategories.maxAttempts',
      DEFAULT_MAX_ATTEMPTS,
    );
    const limit = batchSize > 0 ? batchSize : OBJECT_CATEGORIES_WORKER_BATCH_SIZE;

    const tasks = await this.objectCategoriesSyncQueueRepository.claimBatch(
      limit,
      OBJECT_CATEGORIES_RETRY_AFTER_SEC,
    );

    for (const task of tasks) {
      await this.processTask(task, maxAttempts);
    }
  }

  /**
   * Removes the claimed queue row unless it was re-enqueued during processing; a re-enqueued row
   * is released for the next batch instead.
   */
  private async finishTask(task: ObjectCategoriesSyncQueueRow): Promise<void> {
    const removed = await this.objectCategoriesSyncQueueRepository.deleteClaimed(
      task.object_id,
      task.enqueued_at,
    );
    if (!removed) {
      await this.objectCategoriesSyncQueueRepository.resetAttempt(task.object_id);
    }
  }

  private async processTask(task: ObjectCategoriesSyncQueueRow, maxAttempts: number): Promise<void> {
    const objectId = task.object_id;
    try {
      const { objects, voterWaivPowers } =
        await this.aggregatedObjectRepository.loadByObjectIds([objectId]);
      const aggregated = objects[0];
      if (!aggregated) {
        this.logger.warn(`object_categories: '${objectId}' not found; dropping queue row`);
        await this.finishTask(task);
        return;
      }

      const governance = await this.governanceCacheService.resolvePlatform();
      const views = this.objectViewService.resolve([aggregated], voterWaivPowers, {
        update_types: [UPDATE_TYPES.CATEGORY],
        governance,
      });
      const view = views[0];
      const field = view?.fields[UPDATE_TYPES.CATEGORY];
      const values = field?.values ?? [];

      const picks = values.slice(0, MAX_CATEGORIES_PER_OBJECT);
      const names = picks
        .map((v) => v.value_text?.trim())
        .filter((t): t is string => !!t && t.length > 0);

      let maxSeq = BigInt(0);
      if (picks.length > 0) {
        for (const v of picks) {
          if (v.event_seq > maxSeq) {
            maxSeq = v.event_seq;
          }
        }
      } else {
        const categoryUpdates = aggregated.updates.filter(
          (u) => u.update_type === UPDATE_TYPES.CATEGORY,
        );
        for (const u of categoryUpdates) {
          if (u.event_seq > maxSeq) {
            maxSeq = u.event_seq;
          }
        }
      }

      const coreRow = aggregated.core;
      const previous = await this.objectCategoriesRepository.findByObjectId(objectId);
      // Scopes group objects by COALESCE(meta_group_id, object_id), so a group change counts too.
      const scopesAffected =
        !sameCategoryNames(previous?.category_names ?? [], names) ||
        (previous?.meta_group_id ?? null) !== (coreRow.meta_group_id ?? null);
      const userScopeKeys = scopesAffected
        ? await this.userCategoryScopeEnqueueService.objectAudienceScopeKeys(
            objectId,
            coreRow.object_type,
          )
        : [];
      const enqueuedAt = Math.floor(Date.now() / 1000);

      // Scopes are enqueued in the same transaction as the upsert, so they are rebuilt from the
      // new row and a failed enqueue retries the whole task.
      await this.db.transaction().execute(async (trx) => {
        await this.objectCategoriesRepository.upsert(
          {
            object_id: objectId,
            meta_group_id: coreRow.meta_group_id,
            category_names: names,
            updated_at_seq: maxSeq,
          },
          trx,
        );
        if (!scopesAffected) {
          return;
        }
        await this.relatedSyncQueueRepository.enqueue('global', GLOBAL_SCOPE_KEY, enqueuedAt, trx);
        await this.relatedSyncQueueRepository.enqueueMany('user', userScopeKeys, enqueuedAt, trx);
      });

      await this.finishTask(task);
    } catch (error: unknown) {
      this.logger.error(
        `object_categories recompute '${objectId}': ${error instanceof Error ? error.message : String(error)}`,
      );
      if (task.attempts >= maxAttempts) {
        await this.finishTask(task);
      } else {
        await this.objectCategoriesSyncQueueRepository.resetAttempt(objectId);
      }
    }
  }
}
