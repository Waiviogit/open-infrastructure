import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ObjectSearchQueueRepository,
  SEARCH_DOC_UPDATE_TYPES,
} from '@opden-data-layer/object-search';
import { GovernanceCacheService } from '../../governance/governance-cache.service';
import {
  GovernanceObjectMutatedEvent,
  GOVERNANCE_OBJECT_MUTATED_EVENT,
} from '../../governance/governance-object-mutated.event';
import { ObjectCreatedEvent, OBJECT_CREATED_EVENT } from '../object-created.event';
import {
  ObjectUpdateMutatedEvent,
  OBJECT_UPDATE_MUTATED_EVENT,
} from '../object-update-mutated.event';
import { OwnershipChangedEvent, OWNERSHIP_CHANGED_EVENT } from '../ownership-changed.event';

const SEARCH_DOC_UPDATE_TYPE_SET: ReadonlySet<string> = new Set(SEARCH_DOC_UPDATE_TYPES);

/**
 * Enqueues objects whose search document may have changed; `ObjectSearchDocsWorker` recomputes
 * them. Status and `meta_group_id` changes enqueue in the transaction of their write
 * (`ObjectStatusHandler`, `MetaGroupSyncHandler`), not here.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
@Injectable()
export class ObjectSearchSyncHandler {
  private readonly logger = new Logger(ObjectSearchSyncHandler.name);

  constructor(
    private readonly objectSearchQueueRepository: ObjectSearchQueueRepository,
    private readonly governanceCacheService: GovernanceCacheService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(OBJECT_CREATED_EVENT)
  async handleObjectCreated(event: ObjectCreatedEvent): Promise<void> {
    await this.enqueue(event.objectId);
  }

  @OnEvent(OBJECT_UPDATE_MUTATED_EVENT)
  async handleObjectUpdateMutated(event: ObjectUpdateMutatedEvent): Promise<void> {
    if (!SEARCH_DOC_UPDATE_TYPE_SET.has(event.updateType)) {
      return;
    }
    await this.enqueue(event.objectId);
  }

  /** Ownership decides which updates of the object are valid. */
  @OnEvent(OWNERSHIP_CHANGED_EVENT)
  async handleOwnershipChanged(event: OwnershipChangedEvent): Promise<void> {
    await this.enqueue(event.objectId);
  }

  /**
   * Platform governance decides the winners of every object, so a change to it would touch all
   * documents. It is not rebuilt automatically: the operator runs the rebuild command.
   * The event fires for every object mutation; only platform governance objects are reported.
   */
  @OnEvent(GOVERNANCE_OBJECT_MUTATED_EVENT)
  async handleGovernanceObjectMutated(event: GovernanceObjectMutatedEvent): Promise<void> {
    const objectId = event.objectId.trim();
    if (objectId.length === 0) {
      return;
    }
    try {
      if (!(await this.isPlatformGovernanceObject(objectId))) {
        return;
      }
      this.logger.warn(
        `platform governance object '${objectId}' changed; object search documents may be stale, run \`pnpm search-docs:rebuild --all\``,
      );
    } catch (error) {
      this.logger.error(
        `object search governance check failed for '${objectId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async isPlatformGovernanceObject(objectId: string): Promise<boolean> {
    const platformId = (this.configService.get<string>('governance.objectId') ?? '').trim();
    if (platformId.length === 0) {
      return false;
    }
    if (objectId === platformId) {
      return true;
    }
    const platform = await this.governanceCacheService.resolvePlatform();
    return platform.inherits_from.some((entry) => entry.object_id === objectId);
  }

  private async enqueue(rawObjectId: string): Promise<void> {
    const objectId = rawObjectId.trim();
    if (objectId.length === 0) {
      return;
    }
    try {
      await this.objectSearchQueueRepository.enqueue(objectId, Math.floor(Date.now() / 1000));
    } catch (error) {
      this.logger.error(
        `object search enqueue failed for '${objectId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
