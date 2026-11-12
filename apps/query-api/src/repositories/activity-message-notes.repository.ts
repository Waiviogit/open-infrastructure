import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import type {
  ActivityMessageNote,
  NewActivityMessageNote,
} from '@opden-data-layer/odl-db-types';

import type { Database } from '../database';
import { KYSELY } from '../database';

type DbExecutor = Kysely<Database>;

/** Namespaces the advisory lock key so it never shares a hash space with other lock users. */
const NOTES_LOCK_KEY_PREFIX = 'activity_message_notes';

/**
 * Private activity message notes. Every query filters on `author`, so ownership is
 * enforced in SQL. Reads return `[]` on error; writes and transactional checks re-throw.
 */
@Injectable()
export class ActivityMessageNotesRepository {
  private readonly logger = new Logger(ActivityMessageNotesRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  /**
   * Serializes note writes for one (author, message) pair until the surrounding
   * transaction ends. Must be called inside a transaction.
   */
  async lockScope(
    author: string,
    messageId: string,
    trx: DbExecutor,
  ): Promise<void> {
    const key = `${NOTES_LOCK_KEY_PREFIX}:${author}:${messageId}`;
    try {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`.execute(
        trx,
      );
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async countByAuthorMessage(
    author: string,
    messageId: string,
    trx?: DbExecutor,
  ): Promise<number> {
    try {
      const result = await this.executor(trx)
        .selectFrom('activity_message_notes')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('author', '=', author)
        .where('message_id', '=', messageId)
        .executeTakeFirst();
      return Number(result?.count ?? 0);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  async listByAuthorMessage(
    author: string,
    messageId: string,
    trx?: DbExecutor,
  ): Promise<ActivityMessageNote[]> {
    try {
      return await this.executor(trx)
        .selectFrom('activity_message_notes')
        .selectAll()
        .where('author', '=', author)
        .where('message_id', '=', messageId)
        .orderBy('created_at', 'asc')
        .orderBy('note_id', 'asc')
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      return [];
    }
  }

  async insert(
    row: NewActivityMessageNote,
    trx?: DbExecutor,
  ): Promise<ActivityMessageNote> {
    try {
      return await this.executor(trx)
        .insertInto('activity_message_notes')
        .values({
          author: row.author,
          message_id: row.message_id,
          body: row.body,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Updates the body and `updated_at`; returns `null` when no row matches the author. */
  async updateBody(
    author: string,
    messageId: string,
    noteId: string,
    body: string,
    trx?: DbExecutor,
  ): Promise<ActivityMessageNote | null> {
    try {
      const row = await this.executor(trx)
        .updateTable('activity_message_notes')
        .set({ body, updated_at: sql<Date>`now()` })
        .where('author', '=', author)
        .where('message_id', '=', messageId)
        .where('note_id', '=', noteId)
        .returningAll()
        .executeTakeFirst();
      return row ?? null;
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Returns how many rows were deleted (0 or 1). */
  async deleteOne(
    author: string,
    messageId: string,
    noteId: string,
    trx?: DbExecutor,
  ): Promise<number> {
    try {
      const result = await this.executor(trx)
        .deleteFrom('activity_message_notes')
        .where('author', '=', author)
        .where('message_id', '=', messageId)
        .where('note_id', '=', noteId)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }

  /** Returns how many rows were deleted. */
  async deleteAllByAuthorMessage(
    author: string,
    messageId: string,
    trx?: DbExecutor,
  ): Promise<number> {
    try {
      const result = await this.executor(trx)
        .deleteFrom('activity_message_notes')
        .where('author', '=', author)
        .where('message_id', '=', messageId)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }
}
