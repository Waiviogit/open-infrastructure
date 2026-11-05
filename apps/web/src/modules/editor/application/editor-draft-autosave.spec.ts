import { hasDraftWorthSaving } from './editor-draft-autosave';

const EMPTY_LEXICAL_BODY = JSON.stringify({
  root: {
    type: 'root', version: 1, direction: null, format: '', indent: 0,
    children: [{ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, children: [] }],
  },
});

describe('hasDraftWorthSaving', () => {
  it('does not create a draft for an untouched editor (defaults only, empty paragraph)', () => {
    expect(hasDraftWorthSaving({ title: '  ', body: EMPTY_LEXICAL_BODY, linkedObjectCount: 0 })).toBe(false);
    expect(hasDraftWorthSaving({ title: '', body: '', linkedObjectCount: 0 })).toBe(false);
  });

  it('creates a draft once there is a title, body text or a linked object', () => {
    expect(hasDraftWorthSaving({ title: 'Pizza', body: '', linkedObjectCount: 0 })).toBe(true);
    expect(hasDraftWorthSaving({ title: '', body: 'plain text', linkedObjectCount: 0 })).toBe(true);
    expect(hasDraftWorthSaving({ title: '', body: EMPTY_LEXICAL_BODY, linkedObjectCount: 1 })).toBe(true);
  });
});
