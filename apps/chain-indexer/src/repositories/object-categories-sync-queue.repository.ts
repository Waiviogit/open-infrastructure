import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { ObjectCategoriesSyncQueueRow } from '@opden-data-layer/odl-db-types';

/**
 * Queue of objects whose `object_categories` row must be recomputed.
 * Same re-enqueue / claimed-delete contract as `ObjectCategoriesRelatedSyncQueueRepository`.
 */
@Injectable()
export class ObjectCategoriesSyncQueueRepository {
  private readonly logger = new Logger(ObjectCategoriesSyncQueueRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async enqueue(objectId: string, enqueuedAt: number): Promise<void> {
    try {
      await sql`
        INSERT INTO object_categories_sync_queue (
          object_id,
          enqueued_at,
          attempts,
          last_attempt_at
        )
        VALUES (
          ${objectId},
          ${enqueuedAt},
          0,
          NULL
        )
        ON CONFLICT (object_id) DO UPDATE SET
          enqueued_at = GREATEST(
            object_categories_sync_queue.enqueued_at + 1,
            EXCLUDED.enqueued_at
          ),
          attempts = 0
      `.execute(this.db);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async claimBatch(
    limit: number,
    retryAfterSec: number,
  ): Promise<ObjectCategoriesSyncQueueRow[]> {
    const { rows } = await sql<ObjectCategoriesSyncQueueRow>`
      WITH picked AS (
        SELECT object_id
        FROM object_categories_sync_queue
        WHERE last_attempt_at IS NULL
          OR last_attempt_at < (EXTRACT(EPOCH FROM NOW())::bigint - ${retryAfterSec})
        ORDER BY last_attempt_at NULLS FIRST
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE object_categories_sync_queue q
      SET
        last_attempt_at = EXTRACT(EPOCH FROM NOW())::bigint,
        attempts = q.attempts + 1
      FROM picked
      WHERE q.object_id = picked.object_id
      RETURNING q.*
    `.execute(this.db);

    return rows;
  }

  /**
   * Deletes a claimed row unless it was re-enqueued after the claim
   * (`enqueued_at > claimedEnqueuedAt`). Returns true when the row is gone.
   */
  async deleteClaimed(objectId: string, claimedEnqueuedAt: number | string): Promise<boolean> {
    try {
      const result = await this.db
        .deleteFrom('object_categories_sync_queue')
        .where('object_id', '=', objectId)
        .where('enqueued_at', '<=', sql<number>`${claimedEnqueuedAt}::bigint`)
        .executeTakeFirst();
      return result.numDeletedRows > BigInt(0);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async resetAttempt(objectId: string): Promise<void> {
    await this.db
      .updateTable('object_categories_sync_queue')
      .set({ last_attempt_at: null })
      .where('object_id', '=', objectId)
      .execute();
  }
}
