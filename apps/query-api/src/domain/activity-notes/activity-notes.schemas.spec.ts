import { ACTIVITY_NOTE_BODY_MAX_CHARS } from './activity-notes.constants';
import {
  activityNoteBodySchema,
  activityNoteParamsSchema,
  activityNotesMessageParamsSchema,
} from './activity-notes.schemas';

describe('activity notes schemas', () => {
  it('trims the body and rejects empty, oversize and extra keys', () => {
    expect(activityNoteBodySchema.parse({ body: '  hi  ' })).toEqual({
      body: 'hi',
    });
    expect(activityNoteBodySchema.safeParse({ body: '   ' }).success).toBe(
      false,
    );
    expect(
      activityNoteBodySchema.safeParse({
        body: 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_CHARS + 1),
      }).success,
    ).toBe(false);
    expect(
      activityNoteBodySchema.safeParse({ body: 'hi', extra: 1 }).success,
    ).toBe(false);
  });

  it('rejects a non-uuid noteId and an empty messageId', () => {
    expect(
      activityNoteParamsSchema.safeParse({
        messageId: 'm1',
        noteId: 'not-a-uuid',
      }).success,
    ).toBe(false);
    expect(
      activityNotesMessageParamsSchema.safeParse({ messageId: '  ' }).success,
    ).toBe(false);
    expect(
      activityNoteParamsSchema.parse({
        messageId: ' m1 ',
        noteId: '3b241101-e2bb-4255-8caf-4136c566a962',
      }),
    ).toEqual({
      messageId: 'm1',
      noteId: '3b241101-e2bb-4255-8caf-4136c566a962',
    });
  });
});
