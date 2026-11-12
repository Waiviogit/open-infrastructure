import { ACTIVITY_NOTE_BODY_MAX_LENGTH } from '../constants/activity-notes';
import { buildActivityNoteImportLink } from './activity-note-import-link';

/** Mirrors how the web reads the import hash: `new URLSearchParams(hash).get('note')`. */
function readNoteLikeWeb(url: string): string | null {
  const hash = new URL(url).hash.slice(1);
  return new URLSearchParams(hash).get('note');
}

describe('buildActivityNoteImportLink', () => {
  const base = {
    webOrigin: 'https://waivio.example/',
    objectId: 'abc-cafe',
    messageId: '0123abcd-1-0-0',
  };

  it('builds the activity permalink with a #note= hash', () => {
    const result = buildActivityNoteImportLink({ ...base, markdown: 'Hello' });

    expect(result.url).toBe(
      'https://waivio.example/object/abc-cafe/social/activity/0123abcd-1-0-0#note=Hello',
    );
    expect(result.urlLength).toBe(result.url.length);
    expect(result.bodyLength).toBe(5);
  });

  it('round-trips markdown with fences, plus signs, ampersands and Unicode', () => {
    const markdown = [
      '**Context** · first touch · confidence 0.8 · risk low',
      '',
      '**A**',
      '```',
      'Love this 🍜 — 2+2 & more? #ramen 100% worth it',
      '```',
      '',
      '**B**',
      '```',
      'Привет! a=b&c=d #note=x',
      '```',
    ].join('\n');

    const result = buildActivityNoteImportLink({ ...base, markdown });

    expect(readNoteLikeWeb(result.url)).toBe(markdown);
  });

  it('trims the body before encoding', () => {
    const result = buildActivityNoteImportLink({ ...base, markdown: '  draft \n' });

    expect(readNoteLikeWeb(result.url)).toBe('draft');
    expect(result.bodyLength).toBe(5);
  });

  it('encodes object and message ids as path segments', () => {
    const result = buildActivityNoteImportLink({
      ...base,
      objectId: 'a/b c',
      messageId: 'm#1',
      markdown: 'x',
    });

    expect(result.url).toContain('/object/a%2Fb%20c/social/activity/m%231#note=x');
  });

  it('accepts a body at the length limit', () => {
    const markdown = 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_LENGTH);

    const result = buildActivityNoteImportLink({ ...base, markdown });

    expect(result.bodyLength).toBe(ACTIVITY_NOTE_BODY_MAX_LENGTH);
  });

  it('rejects a body over the length limit', () => {
    const markdown = 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_LENGTH + 1);

    expect(() => buildActivityNoteImportLink({ ...base, markdown })).toThrow(
      `the limit is ${ACTIVITY_NOTE_BODY_MAX_LENGTH}`,
    );
  });

  it('rejects an empty or whitespace-only body', () => {
    expect(() => buildActivityNoteImportLink({ ...base, markdown: ' \n ' })).toThrow(
      'Note body is empty',
    );
  });

  it('rejects missing ids', () => {
    expect(() =>
      buildActivityNoteImportLink({ ...base, objectId: ' ', markdown: 'x' }),
    ).toThrow('objectId is required');
    expect(() =>
      buildActivityNoteImportLink({ ...base, messageId: '', markdown: 'x' }),
    ).toThrow('messageId is required');
  });

  it('rejects unpaired surrogates with a clear error', () => {
    expect(() =>
      buildActivityNoteImportLink({ ...base, markdown: 'bad \uD800 text' }),
    ).toThrow('body contains invalid Unicode');
  });
});
