import { Logger } from '@nestjs/common';
import type {
  ObjectSearchDocsSyncQueueRow,
  OdlDatabase,
} from '@opden-data-layer/odl-db-types';
import { sql, type Kysely, type RawBuilder, type Transaction } from 'kysely';

import { OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT } from './object-search-queue.constants';

export type ObjectSearchDbExecutor =
  | Kysely<OdlDatabase>
  | Transaction<OdlDatabase>;

/** Active objects without a search document. */
function activeWithoutDocumentIds(): RawBuilder<unknown> {
  return sql`
    SELECT oc.object_id
    FROM objects_core oc
    WHERE oc.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM object_search_docs d WHERE d.object_id = oc.object_id)
  `;
}

/** Documents whose object is not active (must not exist). */
function documentsOfNonActiveIds(): RawBuilder<unknown> {
  return sql`
    SELECT d.object_id
    FROM object_search_docs d
    INNER JOIN objects_core oc ON oc.object_id = d.object_id
    WHERE oc.status <> 'active'
  `;
}

/** A claimed queue row: the id and the `enqueued_at` seen at claim time. */
export type ObjectSearchQueueTask = Pick<
  ObjectSearchDocsSyncQueueRow,
  'object_id' | 'enqueued_at' | 'attempts'
>;

/**
 * `object_search_docs_sync_queue`: objects whose search document must be recomputed.
 *
 * Same contract as the object-categories queues: re-enqueueing bumps `enqueued_at` strictly above
 * its previous value (`GREATEST(old + 1, new)`) and resets `attempts`; `finishClaimed` removes a
 * row only when it was not re-enqueued after the claim, so a change made during processing is
 * never lost. Bulk rows use `enqueued_at = 0`; live events use the unix time and are claimed
 * first (`ORDER BY last_attempt_at NULLS FIRST, enqueued_at DESC`).
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
export class ObjectSearchQueueRepository {
  private readonly logger = new Logger(ObjectSearchQueueRepository.name);

  constructor(private readonly db: Kysely<OdlDatabase>) {}

  private executor(trx?: ObjectSearchDbExecutor): ObjectSearchDbExecutor {
    return trx ?? this.db;
  }

  async enqueue(
    objectId: string,
    enqueuedAt: number,
    trx?: ObjectSearchDbExecutor,
  ): Promise<void> {
    await this.enqueueMany([objectId], enqueuedAt, trx);
  }

  /** One statement; duplicate ids are collapsed and rows go in id order (stable lock order). */
  async enqueueMany(
    objectIds: readonly string[],
    enqueuedAt: number,
    trx?: ObjectSearchDbExecutor,
  ): Promise<void> {
    const ids = [...new Set(objectIds)];
    if (ids.length === 0) {
      return;
    }
    try {
      await sql`
        INSERT INTO object_search_docs_sync_queue AS q (object_id, enqueued_at, attempts, last_attempt_at)
        SELECT t.object_id, ${enqueuedAt}::bigint, 0, NULL
        FROM unnest(${ids}::text[]) AS t(object_id)
        ORDER BY t.object_id COLLATE "C"
        ON CONFLICT (object_id) DO UPDATE SET
          enqueued_at = GREATEST(q.enqueued_at + 1, EXCLUDED.enqueued_at),
          attempts = 0
      `.execute(this.executor(trx));
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Enqueues every `objects_core` row as a bulk row. Returns the number of rows written. */
  async enqueueAll(): Promise<number> {
    return this.enqueueSelected(sql`SELECT oc.object_id FROM objects_core oc`);
  }

  /**
   * Enqueues, as bulk rows, active objects without a document and documents whose object is not
   * active. Returns the number of rows written.
   */
  async enqueueRepair(): Promise<number> {
    return this.enqueueSelected(
      sql`${activeWithoutDocumentIds()} UNION ${documentsOfNonActiveIds()}`,
    );
  }

  /** Read-only page of the `enqueueRepair` selection, in `object_id` order after `afterId`. */
  async listRepairIds(
    afterId: string | null,
    limit: number,
  ): Promise<string[]> {
    try {
      const { rows } = await sql<{ object_id: string }>`
        SELECT s.object_id
        FROM (${activeWithoutDocumentIds()} UNION ${documentsOfNonActiveIds()}) AS s(object_id)
        WHERE ${afterId === null} OR s.object_id > ${afterId ?? ''}
        ORDER BY s.object_id
        LIMIT ${limit}
      `.execute(this.db);
      return rows.map((row) => row.object_id);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Sizes of the two `enqueueRepair` selections (both 0 when documents match statuses). */
  async countRepairCandidates(): Promise<{
    activeWithoutDocument: number;
    documentsOfNonActive: number;
  }> {
    try {
      const { rows } = await sql<{
        active_without_document: string;
        documents_of_non_active: string;
      }>`
        SELECT
          (SELECT count(*) FROM (${activeWithoutDocumentIds()}) a) AS active_without_document,
          (SELECT count(*) FROM (${documentsOfNonActiveIds()}) n) AS documents_of_non_active
      `.execute(this.db);
      return {
        activeWithoutDocument: Number(rows[0]?.active_without_document ?? 0),
        documentsOfNonActive: Number(rows[0]?.documents_of_non_active ?? 0),
      };
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  private async enqueueSelected(
    selectIds: RawBuilder<unknown>,
  ): Promise<number> {
    try {
      const result = await sql`
        INSERT INTO object_search_docs_sync_queue AS q (object_id, enqueued_at, attempts, last_attempt_at)
        SELECT s.object_id, ${OBJECT_SEARCH_QUEUE_BULK_ENQUEUED_AT}::bigint, 0, NULL
        FROM (${selectIds}) AS s(object_id)
        ON CONFLICT (object_id) DO UPDATE SET
          enqueued_at = GREATEST(q.enqueued_at + 1, EXCLUDED.enqueued_at),
          attempts = 0
      `.execute(this.db);
      return Number(result.numAffectedRows ?? 0);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * Claims up to `limit` rows that are new or whose retry window passed: live rows first, then
   * bulk rows. Sets `last_attempt_at` and increments `attempts`.
   */
  async claimBatch(
    limit: number,
    retryAfterSec: number,
  ): Promise<ObjectSearchQueueTask[]> {
    try {
      const { rows } = await sql<ObjectSearchQueueTask>`
        WITH picked AS (
          SELECT object_id
          FROM object_search_docs_sync_queue
          WHERE last_attempt_at IS NULL
            OR last_attempt_at < (EXTRACT(EPOCH FROM NOW())::bigint - ${retryAfterSec})
          ORDER BY last_attempt_at NULLS FIRST, enqueued_at DESC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE object_search_docs_sync_queue q
        SET
          last_attempt_at = EXTRACT(EPOCH FROM NOW())::bigint,
          attempts = q.attempts + 1
        FROM picked
        WHERE q.object_id = picked.object_id
        RETURNING q.object_id, q.enqueued_at, q.attempts
      `.execute(this.db);
      return rows;
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * Done with claimed rows: deletes each row not re-enqueued since its claim
   * (`enqueued_at <= claimed`); a re-enqueued row stays and becomes claimable at once.
   */
  async finishClaimed(tasks: readonly ObjectSearchQueueTask[]): Promise<void> {
    if (tasks.length === 0) {
      return;
    }
    const ids = tasks.map((task) => task.object_id);
    const enqueuedAts = tasks.map((task) => String(task.enqueued_at));
    try {
      await sql`
        DELETE FROM object_search_docs_sync_queue q
        USING unnest(${ids}::text[], ${enqueuedAts}::bigint[]) AS t(object_id, enqueued_at)
        WHERE q.object_id = t.object_id
          AND q.enqueued_at <= t.enqueued_at
      `.execute(this.db);
      await sql`
        UPDATE object_search_docs_sync_queue
        SET last_attempt_at = NULL
        WHERE object_id = ANY(${ids}::text[])
      `.execute(this.db);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /**
   * Failed rows stay queued and become claimable again after the retry window, counted from now.
   * They are never dropped: a missing document hides an active object.
   */
  async releaseClaimed(objectIds: readonly string[]): Promise<void> {
    if (objectIds.length === 0) {
      return;
    }
    try {
      await sql`
        UPDATE object_search_docs_sync_queue
        SET last_attempt_at = EXTRACT(EPOCH FROM NOW())::bigint
        WHERE object_id = ANY(${[...objectIds]}::text[])
      `.execute(this.db);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async countPending(): Promise<number> {
    try {
      const row = await this.db
        .selectFrom('object_search_docs_sync_queue')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .executeTakeFirst();
      return Number(row?.n ?? 0);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }
}
