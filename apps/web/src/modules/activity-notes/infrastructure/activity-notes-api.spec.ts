import { activityNotesPath, mapActivityNoteError } from './activity-notes-api';

describe('activityNotesPath', () => {
  it('encodes the message id and note id', () => {
    expect(activityNotesPath('a/b c')).toBe('/query/v1/messages/a%2Fb%20c/notes');
    expect(activityNotesPath('m', 'n-1')).toBe('/query/v1/messages/m/notes/n-1');
  });
});

describe('mapActivityNoteError', () => {
  it.each([
    [{ code: 'unauthorized' as const }, 'unauthorized'],
    [{ code: 'network' as const }, 'network'],
    [{ code: 'http_error' as const, status: 401 }, 'unauthorized'],
    [{ code: 'http_error' as const, status: 404, apiCode: 'activity_note_not_found' }, 'not_found'],
    [{ code: 'http_error' as const, status: 404, apiCode: 'activity_message_not_found' }, 'not_found'],
    [{ code: 'http_error' as const, status: 409, apiCode: 'activity_notes_limit_reached' }, 'limit_reached'],
    [{ code: 'http_error' as const, status: 409 }, 'http_error'],
    [{ code: 'http_error' as const, status: 400 }, 'invalid'],
    [{ code: 'http_error' as const, status: 500 }, 'http_error'],
  ])('%p → %s', (error, code) => {
    expect(mapActivityNoteError(error)).toEqual({ code });
  });
});
