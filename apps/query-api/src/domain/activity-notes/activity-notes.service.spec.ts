import type { Kysely } from 'kysely';
import type { ActivityMessageNote } from '@opden-data-layer/odl-db-types';

import type { Database } from '../../database';
import type { ActivityMessageNotesRepository } from '../../repositories/activity-message-notes.repository';
import type { MessagingRepository } from '../../repositories/messaging.repository';
import { ACTIVITY_NOTES_MAX_PER_MESSAGE } from './activity-notes.constants';
import {
  ActivityMessageNotFoundError,
  ActivityNoteNotFoundError,
  ActivityNotesLimitReachedError,
} from './activity-notes.errors';
import { ActivityNotesService } from './activity-notes.service';

const AUTHOR = 'alice';
const MESSAGE_ID = 'msg-1';
const NOTE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';

function noteRow(
  overrides: Partial<ActivityMessageNote> = {},
): ActivityMessageNote {
  return {
    note_id: NOTE_ID,
    author: AUTHOR,
    message_id: MESSAGE_ID,
    body: 'hello',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function setup() {
  const trx = { trx: true };
  const db = {
    transaction: jest.fn(() => ({
      execute: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(trx)),
    })),
  };
  const notes = {
    lockScope: jest.fn().mockResolvedValue(undefined),
    countByAuthorMessage: jest.fn().mockResolvedValue(0),
    listByAuthorMessage: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue(noteRow()),
    updateBody: jest.fn().mockResolvedValue(noteRow()),
    deleteOne: jest.fn().mockResolvedValue(1),
    deleteAllByAuthorMessage: jest.fn().mockResolvedValue(0),
  };
  const messaging = {
    messageExists: jest.fn().mockResolvedValue(true),
  };
  const service = new ActivityNotesService(
    db as unknown as Kysely<Database>,
    notes as unknown as ActivityMessageNotesRepository,
    messaging as unknown as MessagingRepository,
  );
  return { service, notes, messaging, trx };
}

describe('ActivityNotesService', () => {
  describe('list', () => {
    it('returns the author notes as views with the limit', async () => {
      const { service, notes } = setup();
      notes.listByAuthorMessage.mockResolvedValue([noteRow()]);

      const result = await service.list(AUTHOR, MESSAGE_ID);

      expect(notes.listByAuthorMessage).toHaveBeenCalledWith(
        AUTHOR,
        MESSAGE_ID,
      );
      expect(result).toEqual({
        items: [
          {
            noteId: NOTE_ID,
            messageId: MESSAGE_ID,
            body: 'hello',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        limit: ACTIVITY_NOTES_MAX_PER_MESSAGE,
      });
    });
  });

  describe('create', () => {
    it('locks, checks the message and count, then inserts in one transaction', async () => {
      const { service, notes, messaging, trx } = setup();
      notes.countByAuthorMessage.mockResolvedValue(
        ACTIVITY_NOTES_MAX_PER_MESSAGE - 1,
      );

      const view = await service.create(AUTHOR, MESSAGE_ID, 'hello');

      expect(notes.lockScope).toHaveBeenCalledWith(AUTHOR, MESSAGE_ID, trx);
      expect(messaging.messageExists).toHaveBeenCalledWith(MESSAGE_ID, trx);
      expect(notes.countByAuthorMessage).toHaveBeenCalledWith(
        AUTHOR,
        MESSAGE_ID,
        trx,
      );
      expect(notes.insert).toHaveBeenCalledWith(
        { author: AUTHOR, message_id: MESSAGE_ID, body: 'hello' },
        trx,
      );
      expect(notes.lockScope.mock.invocationCallOrder[0]).toBeLessThan(
        notes.countByAuthorMessage.mock.invocationCallOrder[0],
      );
      expect(view.noteId).toBe(NOTE_ID);
    });

    it('throws ActivityMessageNotFoundError when the message is missing', async () => {
      const { service, notes, messaging } = setup();
      messaging.messageExists.mockResolvedValue(false);

      await expect(
        service.create(AUTHOR, MESSAGE_ID, 'hello'),
      ).rejects.toBeInstanceOf(ActivityMessageNotFoundError);
      expect(notes.insert).not.toHaveBeenCalled();
    });

    it('throws ActivityNotesLimitReachedError at the limit', async () => {
      const { service, notes } = setup();
      notes.countByAuthorMessage.mockResolvedValue(
        ACTIVITY_NOTES_MAX_PER_MESSAGE,
      );

      await expect(
        service.create(AUTHOR, MESSAGE_ID, 'hello'),
      ).rejects.toBeInstanceOf(ActivityNotesLimitReachedError);
      expect(notes.insert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('returns the updated view', async () => {
      const { service, notes } = setup();
      notes.updateBody.mockResolvedValue(noteRow({ body: 'edited' }));

      const view = await service.update(AUTHOR, MESSAGE_ID, NOTE_ID, 'edited');

      expect(notes.updateBody).toHaveBeenCalledWith(
        AUTHOR,
        MESSAGE_ID,
        NOTE_ID,
        'edited',
      );
      expect(view.body).toBe('edited');
    });

    it('throws ActivityNoteNotFoundError for a foreign or unknown note', async () => {
      const { service, notes } = setup();
      notes.updateBody.mockResolvedValue(null);

      await expect(
        service.update('bob', MESSAGE_ID, NOTE_ID, 'edited'),
      ).rejects.toBeInstanceOf(ActivityNoteNotFoundError);
      expect(notes.updateBody).toHaveBeenCalledWith(
        'bob',
        MESSAGE_ID,
        NOTE_ID,
        'edited',
      );
    });
  });

  describe('delete', () => {
    it('deletes the author note', async () => {
      const { service, notes } = setup();

      await expect(
        service.delete(AUTHOR, MESSAGE_ID, NOTE_ID),
      ).resolves.toBeUndefined();
      expect(notes.deleteOne).toHaveBeenCalledWith(AUTHOR, MESSAGE_ID, NOTE_ID);
    });

    it('throws ActivityNoteNotFoundError when nothing was deleted', async () => {
      const { service, notes } = setup();
      notes.deleteOne.mockResolvedValue(0);

      await expect(
        service.delete('bob', MESSAGE_ID, NOTE_ID),
      ).rejects.toBeInstanceOf(ActivityNoteNotFoundError);
    });
  });

  describe('deleteAll', () => {
    it('is scoped to the author and message and succeeds when none exist', async () => {
      const { service, notes } = setup();

      await expect(
        service.deleteAll(AUTHOR, MESSAGE_ID),
      ).resolves.toBeUndefined();
      expect(notes.deleteAllByAuthorMessage).toHaveBeenCalledWith(
        AUTHOR,
        MESSAGE_ID,
      );
    });
  });
});
