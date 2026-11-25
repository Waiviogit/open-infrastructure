import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  materializeObjectCoreStatus,
  ObjectViewService,
} from '@opden-data-layer/objects-domain';
import { ObjectSearchQueueRepository } from '@opden-data-layer/object-search';
import type { Kysely } from 'kysely';
import { KYSELY, type Database } from '../../../database';
import { GovernanceCacheService } from '../../governance/governance-cache.service';
import {
  AggregatedObjectRepository,
  ObjectTagCategoriesSyncQueueRepository,
  ObjectsCoreRepository,
} from '../../../repositories';
import {
  OBJECT_STATUS_RECOMPUTE_EVENT,
  ObjectStatusRecomputeEvent,
} from '../object-status-created.event';
import {
  OBJECT_ACTIVE_STATE_CHANGED_EVENT,
  ObjectActiveStateChangedEvent,
} from '../object-active-state-changed.event';

function nowUnixSec(): number {
  return Math.floor(Date.now() / 1000);
}

@Injectable()
export class ObjectStatusHandler {
  private readonly logger = new Logger(ObjectStatusHandler.name);

  constructor(
    private readonly governanceCacheService: GovernanceCacheService,
    private readonly aggregatedObjectRepository: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectsCoreRepository: ObjectsCoreRepository,
    private readonly objectTagCategoriesSyncQueueRepository: ObjectTagCategoriesSyncQueueRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly objectSearchQueueRepository: ObjectSearchQueueRepository,
    @Inject(KYSELY) private readonly db: Kysely<Database>,
  ) {}

  @OnEvent(OBJECT_STATUS_RECOMPUTE_EVENT)
  async handleObjectStatusRecompute(event: ObjectStatusRecomputeEvent): Promise<void> {
    const objectId = event.objectId.trim();
    if (objectId.length === 0) {
      return;
    }

    const { objects, voterWaivPowers } =
      await this.aggregatedObjectRepository.loadByObjectIds([objectId]);
    const aggregated = objects[0];
    if (!aggregated) {
      this.logger.warn(
        `object status recompute: object '${objectId}' not found; skipping`,
      );
      return;
    }

    const governance = await this.governanceCacheService.resolvePlatform();
    const nextStatus = materializeObjectCoreStatus(
      aggregated,
      voterWaivPowers,
      governance,
      this.objectViewService,
    );

    const previousStatus = aggregated.core.status;
    if (previousStatus === nextStatus) {
      return;
    }

    const wasActive = previousStatus === 'active';
    const isActive = nextStatus === 'active';
    const activeStateChanged = wasActive !== isActive;

    // A search document exists only while the object is active: crossing that boundary enqueues
    // its recompute in the same transaction, so the status is never stored without it.
    await this.db.transaction().execute(async (trx) => {
      await this.objectsCoreRepository.update(objectId, { status: nextStatus }, trx);
      if (activeStateChanged) {
        await this.objectSearchQueueRepository.enqueue(objectId, nowUnixSec(), trx);
      }
    });

    if (activeStateChanged) {
      this.eventEmitter.emit(
        OBJECT_ACTIVE_STATE_CHANGED_EVENT,
        new ObjectActiveStateChangedEvent(objectId, aggregated.core.object_type, isActive),
      );
      try {
        await this.objectTagCategoriesSyncQueueRepository.enqueue(
          objectId,
          nowUnixSec(),
        );
      } catch (error) {
        this.logger.error(
          `object status recompute: tag category enqueue failed for '${objectId}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
