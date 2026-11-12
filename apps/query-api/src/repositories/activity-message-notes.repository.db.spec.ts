import { randomUUID } from 'crypto';
import type { Kysely } from 'kysely';
import { migrateToLatest } from '@opden-data-layer/migrations';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import {
  createTestDb,
  resolveTestPostgresUrl,
  withRollback,
} from '@opden-data-layer/test-postgres';

import type { Database } from '../database';
import { ACTIVITY_NOTES_MAX_PER_MESSAGE } from '../domain/activity-notes/activity-notes.constants';
import { ActivityNotesLimitReachedError } from '../domain/activity-notes/activity-notes.errors';
import { ActivityNotesService } from '../domain/activity-notes/activity-notes.service';
import { ActivityMessageNotesRepository } from './activity-message-notes.repository';
import { MessagingRepository } from './messaging.repository';

const describeDb = process.env.POSTGRES_TEST_URL ? describe : describe.skip;

type Trx = Kysely<OdlDatabase>;

function asDatabase(db: Trx): Kysely<Database> {
  return db as unknown as Kysely<Database>;
}

async function insertMessage(
  db: Trx,
  channelId: string,
  messageId: string,
): Promise<void> {
  await db
    .insertInto('channels')
    .values({
      channel_id: channelId,
      kind: 'group',
      creator: 'alice',
      title: null,
      object_id: null,
      access: 'public_read',
      dissolved_at_unix: null,
      created_at_unix: 1,
      event_seq: BigInt(1),
      transaction_id: `tx-${channelId}`,
    })
    .execute();
  await db
    .insertInto('messages')
    .values({
      message_id: messageId,
      channel_id: channelId,
      author: 'alice',
      body: 'body',
      mentions: [],
      linked_object_ids: [],
      created_at_unix: 1,
      event_seq: BigInt(1),
      transaction_id: `tx-${messageId}`,
      dup_group_id: messageId,
      image_phashes: [],
    })
    .execute();
}

describeDb('ActivityMessageNotesRepository', () => {
  const db = createTestDb();

  beforeAll(async () => {
    const migrated = await migrateToLatest({
      connectionString: resolveTestPostgresUrl(),
    });
    if (migrated.error) {
      throw migrated.error;
    }
  }, 60_000);

  afterAll(async () => {
    await db.destroy();
  });

  it('isolates notes by author on list, update and delete', async () => {
    await withRollback(db, async (trx) => {
      await insertMessage(trx, 'ch-iso', 'msg-iso');
      const repo = new ActivityMessageNotesRepository(asDatabase(trx));
      const own = await repo.insert({
        author: 'alice',
        message_id: 'msg-iso',
        body: 'a1',
      });
      await repo.insert({ author: 'bob', message_id: 'msg-iso', body: 'b1' });

      const aliceNotes = await repo.listByAuthorMessage('alice', 'msg-iso');
      expect(aliceNotes.map((n) => n.body)).toEqual(['a1']);

      expect(
        await repo.updateBody('bob', 'msg-iso', own.note_id, 'hijack'),
      ).toBeNull();
      expect(await repo.deleteOne('bob', 'msg-iso', own.note_id)).toBe(0);
      expect(await repo.deleteAllByAuthorMessage('bob', 'msg-iso')).toBe(1);

      const updated = await repo.updateBody(
        'alice',
        'msg-iso',
        own.note_id,
        'edited',
      );
      expect(updated?.body).toBe('edited');
      expect(updated && updated.updated_at.getTime()).toBeGreaterThanOrEqual(
        own.updated_at.getTime(),
      );
      expect(await repo.countByAuthorMessage('alice', 'msg-iso')).toBe(1);
    });
  });

  it('removes notes when the message row is deleted', async () => {
    await withRollback(db, async (trx) => {
      await insertMessage(trx, 'ch-cascade', 'msg-cascade');
      const repo = new ActivityMessageNotesRepository(asDatabase(trx));
      await repo.insert({
        author: 'alice',
        message_id: 'msg-cascade',
        body: 'n',
      });

      await trx
        .deleteFrom('messages')
        .where('message_id', '=', 'msg-cascade')
        .execute();

      expect(await repo.listByAuthorMessage('alice', 'msg-cascade')).toEqual(
        [],
      );
    });
  });

  it('lets only one of two parallel creates take the last slot', async () => {
    const suffix = randomUUID();
    const channelId = `ch-lock-${suffix}`;
    const messageId = `msg-lock-${suffix}`;
    await insertMessage(db, channelId, messageId);
    try {
      const database = asDatabase(db);
      const repo = new ActivityMessageNotesRepository(database);
      const service = new ActivityNotesService(
        database,
        repo,
        new MessagingRepository(database),
      );
      for (let i = 0; i < ACTIVITY_NOTES_MAX_PER_MESSAGE - 1; i += 1) {
        await repo.insert({
          author: 'alice',
          message_id: messageId,
          body: `n${i}`,
        });
      }

      const results = await Promise.allSettled([
        service.create('alice', messageId, 'last-a'),
        service.create('alice', messageId, 'last-b'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect(
        rejected && rejected.status === 'rejected' && rejected.reason,
      ).toBeInstanceOf(ActivityNotesLimitReachedError);
      expect(await repo.countByAuthorMessage('alice', messageId)).toBe(
        ACTIVITY_NOTES_MAX_PER_MESSAGE,
      );
    } finally {
      await db
        .deleteFrom('messages')
        .where('message_id', '=', messageId)
        .execute();
      await db
        .deleteFrom('channels')
        .where('channel_id', '=', channelId)
        .execute();
    }
  });
});
