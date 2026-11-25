import {
  ObjectViewService,
  type GovernanceSnapshot,
} from '@opden-data-layer/objects-domain';

import {
  buildObjectSearchDocument,
  type ObjectSearchDocument,
  type ObjectViewResolver,
} from '../document';
import type { ObjectSearchSink } from '../sink';
import type { ObjectSearchSourceLoader } from '../source';

export interface ObjectSearchRebuildOptions {
  /** Rewrite documents even when their content hash is unchanged. */
  force?: boolean;
  /** Build documents and count them; write nothing. */
  dryRun?: boolean;
}

export interface ObjectSearchRebuildResult {
  /** `objects_core` rows found for the requested ids. */
  loaded: number;
  /** Documents handed to the sinks. */
  upserted: number;
  /** Ineligible objects (not active, or dropped by the resolver) whose document is removed. */
  deleted: number;
  /** Requested ids without a core row; ignored (the FK cascade already removed their document). */
  missing: number;
}

/**
 * Recomputes the search documents of a batch of objects and writes them to every sink. The one
 * implementation behind the chain-indexer worker and `pnpm search-docs:rebuild`, so both write
 * identical rows. A load error propagates before anything is written.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
export class ObjectSearchRebuildService {
  constructor(
    private readonly source: ObjectSearchSourceLoader,
    private readonly sinks: readonly ObjectSearchSink[],
    private readonly objectViewService: ObjectViewResolver = new ObjectViewService(),
  ) {}

  async rebuild(
    objectIds: readonly string[],
    governance: GovernanceSnapshot,
    options: ObjectSearchRebuildOptions = {},
  ): Promise<ObjectSearchRebuildResult> {
    const requested = new Set(objectIds);
    const { objects, voterWaivPowers, geoByUpdateId } = await this.source.load([
      ...requested,
    ]);

    const upserts: ObjectSearchDocument[] = [];
    const deleteIds: string[] = [];
    for (const aggregated of objects) {
      const doc = buildObjectSearchDocument(
        aggregated,
        voterWaivPowers,
        governance,
        this.objectViewService,
        geoByUpdateId,
      );
      if (doc) {
        upserts.push(doc);
      } else {
        deleteIds.push(aggregated.core.object_id);
      }
    }

    if (!options.dryRun) {
      for (const sink of this.sinks) {
        await sink.apply({ upserts, deleteIds }, { force: options.force });
      }
    }

    return {
      loaded: objects.length,
      upserted: upserts.length,
      deleted: deleteIds.length,
      missing: requested.size - objects.length,
    };
  }
}
