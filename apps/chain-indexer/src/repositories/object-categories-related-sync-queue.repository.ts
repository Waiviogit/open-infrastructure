import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { ObjectCategoriesRelatedScopeType, ObjectCategoriesRelatedSyncQueueRow } from '@opden-data-layer/odl-db-types';

type DbExecutor = Kysely<Database> | Transaction<Database>;

/**
 * Queue of `object_categories_related` scopes to rebuild.
 *
 * Re-enqueueing an existing key bumps `enqueued_at` strictly above its previous value
 * (`GREATEST(old + 1, new)`, so two enqueues in the same second still differ) and resets
 * `attempts`. `deleteClaimed` only removes the row when it was not re-enqueued after the claim,
 * so a change that arrives while a worker processes the scope is never lost.
 */
@Injectable()
export class ObjectCategoriesRelatedSyncQueueRepository {
  private readonly logger = new Logger(ObjectCategoriesRelatedSyncQueueRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  private executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  async enqueue(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    enqueuedAt: number,
    trx?: DbExecutor,
  ): Promise<void> {
    await this.enqueueMany(scopeType, [scopeKey], enqueuedAt, trx);
  }

  /** One multi-row insert; duplicate keys in `scopeKeys` are collapsed. */
  async enqueueMany(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKeys: readonly string[],
    enqueuedAt: number,
    trx?: DbExecutor,
  ): Promise<void> {
    const keys = [...new Set(scopeKeys)];
    if (keys.length === 0) {
      return;
    }
    const values = sql.join(
      keys.map((key) => sql`(${scopeType}, ${key}, ${enqueuedAt}::bigint, 0, NULL::bigint)`),
      sql`, `,
    );
    try {
      await sql`
        INSERT INTO object_categories_related_sync_queue (
          scope_type,
          scope_key,
          enqueued_at,
          attempts,
          last_attempt_at
        )
        VALUES ${values}
        ON CONFLICT (scope_type, scope_key) DO UPDATE SET
          enqueued_at = GREATEST(
            object_categories_related_sync_queue.enqueued_at + 1,
            EXCLUDED.enqueued_at
          ),
          attempts = 0
      `.execute(this.executor(trx));
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async claimBatch(
    limit: number,
    retryAfterSec: number,
  ): Promise<ObjectCategoriesRelatedSyncQueueRow[]> {
    const { rows } = await sql<ObjectCategoriesRelatedSyncQueueRow>`
      WITH picked AS (
        SELECT scope_type, scope_key
        FROM object_categories_related_sync_queue
        WHERE last_attempt_at IS NULL
          OR last_attempt_at < (EXTRACT(EPOCH FROM NOW())::bigint - ${retryAfterSec})
        ORDER BY last_attempt_at NULLS FIRST
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE object_categories_related_sync_queue q
      SET
        last_attempt_at = EXTRACT(EPOCH FROM NOW())::bigint,
        attempts = q.attempts + 1
      FROM picked
      WHERE q.scope_type = picked.scope_type AND q.scope_key = picked.scope_key
      RETURNING q.*
    `.execute(this.db);

    return rows;
  }

  /**
   * Deletes a claimed row unless it was re-enqueued after the claim
   * (`enqueued_at > claimedEnqueuedAt`). Returns true when the row is gone.
   */
  async deleteClaimed(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
    claimedEnqueuedAt: number | string,
  ): Promise<boolean> {
    try {
      const result = await this.db
        .deleteFrom('object_categories_related_sync_queue')
        .where('scope_type', '=', scopeType)
        .where('scope_key', '=', scopeKey)
        .where('enqueued_at', '<=', sql<number>`${claimedEnqueuedAt}::bigint`)
        .executeTakeFirst();
      return result.numDeletedRows > BigInt(0);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async resetAttempt(
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
  ): Promise<void> {
    await this.db
      .updateTable('object_categories_related_sync_queue')
      .set({ last_attempt_at: null })
      .where('scope_type', '=', scopeType)
      .where('scope_key', '=', scopeKey)
      .execute();
  }
}
