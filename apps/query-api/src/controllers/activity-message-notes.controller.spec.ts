import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessUser } from '../auth';
import {
  ActivityMessageNotFoundError,
  ActivityNoteNotFoundError,
  ActivityNotesLimitReachedError,
  type ActivityNotesService,
} from '../domain/activity-notes';
import { ActivityMessageNotesController } from './activity-message-notes.controller';

const USER = { sub: ' Alice ' } as JwtAccessUser;
const NOTE_ID = '3b241101-e2bb-4255-8caf-4136c566a962';

function setup() {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
  };
  const controller = new ActivityMessageNotesController(
    service as unknown as ActivityNotesService,
  );
  return { controller, service };
}

async function caught(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected rejection');
}

describe('ActivityMessageNotesController', () => {
  it('scopes calls to the normalized token subject', async () => {
    const { controller, service } = setup();
    service.list.mockResolvedValue({ items: [], limit: 10 });

    await controller.list(USER, { messageId: 'm1' });
    await controller.removeAll(USER, { messageId: 'm1' });

    expect(service.list).toHaveBeenCalledWith('alice', 'm1');
    expect(service.deleteAll).toHaveBeenCalledWith('alice', 'm1');
  });

  it('maps a missing message to 404 activity_message_not_found', async () => {
    const { controller, service } = setup();
    service.create.mockRejectedValue(new ActivityMessageNotFoundError('m1'));

    const error = await caught(
      controller.create(USER, { messageId: 'm1' }, { body: 'x' }),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'activity_message_not_found' }),
    );
  });

  it('maps the limit to 409 activity_notes_limit_reached', async () => {
    const { controller, service } = setup();
    service.create.mockRejectedValue(new ActivityNotesLimitReachedError(10));

    const error = await caught(
      controller.create(USER, { messageId: 'm1' }, { body: 'x' }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ code: 'activity_notes_limit_reached' }),
    );
  });

  it('maps an unknown note to 404 activity_note_not_found on update and delete', async () => {
    const { controller, service } = setup();
    service.update.mockRejectedValue(new ActivityNoteNotFoundError(NOTE_ID));
    service.delete.mockRejectedValue(new ActivityNoteNotFoundError(NOTE_ID));
    const params = { messageId: 'm1', noteId: NOTE_ID };

    const updateError = await caught(
      controller.update(USER, params, { body: 'x' }),
    );
    const deleteError = await caught(controller.remove(USER, params));

    for (const error of [updateError, deleteError]) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ code: 'activity_note_not_found' }),
      );
    }
  });

  it('re-throws unexpected errors unchanged', async () => {
    const { controller, service } = setup();
    const boom = new Error('db down');
    service.create.mockRejectedValue(boom);

    await expect(
      controller.create(USER, { messageId: 'm1' }, { body: 'x' }),
    ).rejects.toBe(boom);
  });
});
