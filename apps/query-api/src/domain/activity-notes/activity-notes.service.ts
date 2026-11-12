import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { ActivityMessageNote } from '@opden-data-layer/odl-db-types';

import type { Database } from '../../database';
import { KYSELY } from '../../database';
import { ActivityMessageNotesRepository } from '../../repositories/activity-message-notes.repository';
import { MessagingRepository } from '../../repositories/messaging.repository';
import { ACTIVITY_NOTES_MAX_PER_MESSAGE } from './activity-notes.constants';
import {
  ActivityMessageNotFoundError,
  ActivityNoteNotFoundError,
  ActivityNotesLimitReachedError,
} from './activity-notes.errors';
import type {
  ActivityNoteListResponse,
  ActivityNoteView,
} from './activity-notes.schemas';

/**
 * Private notes on activity messages. `author` is always the JWT subject (normalized);
 * every repository call is scoped to it, so other accounts' notes are never visible.
 */
@Injectable()
export class ActivityNotesService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<Database>,
    private readonly notes: ActivityMessageNotesRepository,
    private readonly messaging: MessagingRepository,
  ) {}

  async list(
    author: string,
    messageId: string,
  ): Promise<ActivityNoteListResponse> {
    const rows = await this.notes.listByAuthorMessage(author, messageId);
    return { items: rows.map(toView), limit: ACTIVITY_NOTES_MAX_PER_MESSAGE };
  }

  /**
   * Lock → message check → count → insert in one transaction, so two parallel creates
   * cannot both pass the limit check.
   */
  async create(
    author: string,
    messageId: string,
    body: string,
  ): Promise<ActivityNoteView> {
    const row = await this.db.transaction().execute(async (trx) => {
      await this.notes.lockScope(author, messageId, trx);

      const exists = await this.messaging.messageExists(messageId, trx);
      if (!exists) {
        throw new ActivityMessageNotFoundError(messageId);
      }

      const count = await this.notes.countByAuthorMessage(
        author,
        messageId,
        trx,
      );
      if (count >= ACTIVITY_NOTES_MAX_PER_MESSAGE) {
        throw new ActivityNotesLimitReachedError(
          ACTIVITY_NOTES_MAX_PER_MESSAGE,
        );
      }

      return this.notes.insert({ author, message_id: messageId, body }, trx);
    });
    return toView(row);
  }

  async update(
    author: string,
    messageId: string,
    noteId: string,
    body: string,
  ): Promise<ActivityNoteView> {
    const row = await this.notes.updateBody(author, messageId, noteId, body);
    if (!row) {
      throw new ActivityNoteNotFoundError(noteId);
    }
    return toView(row);
  }

  async delete(
    author: string,
    messageId: string,
    noteId: string,
  ): Promise<void> {
    const deleted = await this.notes.deleteOne(author, messageId, noteId);
    if (deleted === 0) {
      throw new ActivityNoteNotFoundError(noteId);
    }
  }

  async deleteAll(author: string, messageId: string): Promise<void> {
    await this.notes.deleteAllByAuthorMessage(author, messageId);
  }
}

function toView(row: ActivityMessageNote): ActivityNoteView {
  return {
    noteId: row.note_id,
    messageId: row.message_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
