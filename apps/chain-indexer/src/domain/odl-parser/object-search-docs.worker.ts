import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import type { GovernanceSnapshot } from '@opden-data-layer/objects-domain';
import {
  ObjectSearchQueueRepository,
  ObjectSearchRebuildService,
  type ObjectSearchQueueTask,
} from '@opden-data-layer/object-search';
import { GovernanceCacheService } from '../governance/governance-cache.service';
import {
  OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC,
  OBJECT_SEARCH_DOCS_WORKER_INTERVAL_NAME,
} from '../../constants/object-search-docs.constants';

interface ObjectSearchDocsWorkerSettings {
  batchSize: number;
  maxBatchesPerTick: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Drains `object_search_docs_sync_queue`: recomputes the search documents of claimed objects
 * through `ObjectSearchRebuildService` (which writes every sink). A failing object stays queued
 * and is retried after the retry window; it is never dropped, since a missing document hides an
 * active object from search.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
@Injectable()
export class ObjectSearchDocsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectSearchDocsWorker.name);
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly objectSearchQueueRepository: ObjectSearchQueueRepository,
    private readonly objectSearchRebuildService: ObjectSearchRebuildService,
    private readonly governanceCacheService: GovernanceCacheService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.getOrThrow<number>('objectSearchDocs.intervalMs');
    const id = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.schedulerRegistry.addInterval(OBJECT_SEARCH_DOCS_WORKER_INTERVAL_NAME, id);
  }

  onModuleDestroy(): void {
    try {
      this.schedulerRegistry.deleteInterval(OBJECT_SEARCH_DOCS_WORKER_INTERVAL_NAME);
    } catch {
      // Tests may omit ScheduleModule.
    }
  }

  /** One worker tick; skipped while the previous tick is still running. */
  async tick(): Promise<void> {
    if (this.running) {
      this.logger.debug('object_search_docs: previous tick still running; skipping');
      return;
    }
    this.running = true;
    try {
      await this.drain();
    } catch (error: unknown) {
      this.logger.error(`object_search_docs tick failed: ${errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** Claims and processes batches while they come back full, up to `maxBatchesPerTick`. */
  private async drain(): Promise<void> {
    const { batchSize, maxBatchesPerTick } = this.settings();
    for (let batch = 0; batch < maxBatchesPerTick; batch += 1) {
      const tasks = await this.objectSearchQueueRepository.claimBatch(
        batchSize,
        OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC,
      );
      if (tasks.length === 0) {
        return;
      }
      await this.processBatch(tasks);
      if (tasks.length < batchSize) {
        return;
      }
    }
  }

  private async processBatch(tasks: readonly ObjectSearchQueueTask[]): Promise<void> {
    let governance: GovernanceSnapshot;
    try {
      governance = await this.governanceCacheService.resolvePlatform();
    } catch (error: unknown) {
      await this.objectSearchQueueRepository.releaseClaimed(tasks.map((task) => task.object_id));
      throw error;
    }

    const ids = tasks.map((task) => task.object_id);
    try {
      const result = await this.objectSearchRebuildService.rebuild(ids, governance);
      this.logger.debug(
        `object_search_docs: ${tasks.length} claimed, ${result.upserted} upserted, ${result.deleted} deleted, ${result.missing} missing`,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `object_search_docs: batch of ${tasks.length} failed (${errorMessage(error)}); retrying one by one`,
      );
      await this.processOneByOne(tasks, governance);
      return;
    }
    await this.objectSearchQueueRepository.finishClaimed(tasks);
  }

  private async processOneByOne(
    tasks: readonly ObjectSearchQueueTask[],
    governance: GovernanceSnapshot,
  ): Promise<void> {
    const done: ObjectSearchQueueTask[] = [];
    const failedIds: string[] = [];
    for (const task of tasks) {
      try {
        await this.objectSearchRebuildService.rebuild([task.object_id], governance);
        done.push(task);
      } catch (error: unknown) {
        failedIds.push(task.object_id);
        this.logger.error(
          `object_search_docs: '${task.object_id}' failed (attempts ${task.attempts}); kept queued for retry: ${errorMessage(error)}`,
        );
      }
    }
    await this.objectSearchQueueRepository.finishClaimed(done);
    await this.objectSearchQueueRepository.releaseClaimed(failedIds);
  }

  private settings(): ObjectSearchDocsWorkerSettings {
    return {
      batchSize: this.configService.getOrThrow<number>('objectSearchDocs.batchSize'),
      maxBatchesPerTick: this.configService.getOrThrow<number>(
        'objectSearchDocs.maxBatchesPerTick',
      ),
    };
  }
}
