import {
  decideHostBodyDraftSave,
  hashHostBodySource,
  isHostBodyDraftRecord,
} from './host-body-draft';

describe('hashHostBodySource', () => {
  it('is stable, ignores surrounding whitespace and changes with the body', () => {
    expect(hashHostBodySource('Hello')).toBe(hashHostBodySource('  Hello\n'));
    expect(hashHostBodySource('Hello')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashHostBodySource('Hello')).not.toBe(hashHostBodySource('Hello!'));
  });
});

describe('decideHostBodyDraftSave', () => {
  it('removes an empty body', () => {
    expect(
      decideHostBodyDraftSave({ format: 'markdown', markdown: '  ', publishedSources: ['x'] }),
    ).toBe('remove');
    expect(
      decideHostBodyDraftSave({ format: 'html', markdown: '```html\n\n```', publishedSources: [] }),
    ).toBe('remove');
  });

  it('removes a body equal to the published one', () => {
    expect(
      decideHostBodyDraftSave({
        format: 'markdown',
        markdown: '# Terms\n\nText\n',
        publishedSources: ['# Terms\n\nText'],
      }),
    ).toBe('remove');
    expect(
      decideHostBodyDraftSave({
        format: 'html',
        markdown: '```html\n<p>x</p>\n```',
        publishedSources: ['<p>x</p>'],
      }),
    ).toBe('remove');
  });

  it('removes a body equal to one published in this session', () => {
    expect(
      decideHostBodyDraftSave({
        format: 'markdown',
        markdown: 'New text',
        publishedSources: ['Old text', 'New text'],
      }),
    ).toBe('remove');
  });

  it('saves a changed body', () => {
    expect(
      decideHostBodyDraftSave({ format: 'markdown', markdown: 'New', publishedSources: ['Old'] }),
    ).toBe('save');
  });

  it('saves an HTML page that does not extract yet (work in progress)', () => {
    expect(
      decideHostBodyDraftSave({ format: 'html', markdown: '<p>typed as text</p>', publishedSources: [] }),
    ).toBe('save');
  });
});

describe('isHostBodyDraftRecord', () => {
  const valid = {
    username: 'alice',
    objectId: 'about-us',
    updateType: 'pageContent',
    body: '{"root":{}}',
    baseSourceHash: 'abcd1234',
    updatedAt: 1,
  };

  it('accepts a complete record', () => {
    expect(isHostBodyDraftRecord(valid)).toBe(true);
  });

  it.each([
    null,
    'draft',
    { ...valid, username: '' },
    { ...valid, body: 42 },
    { ...valid, updatedAt: Number.NaN },
    { ...valid, baseSourceHash: undefined },
  ])('rejects %p', (record) => {
    expect(isHostBodyDraftRecord(record)).toBe(false);
  });
});
