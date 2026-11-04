import { toStreamEntries } from './stream-entries';

describe('toStreamEntries', () => {
  it('maps field pairs to a field map', () => {
    expect(
      toStreamEntries([['1-0', ['data', '{"type":"x"}', 'extra', '1']]]),
    ).toEqual([{ id: '1-0', fields: { data: '{"type":"x"}', extra: '1' } }]);
  });

  it('keeps a trimmed pending entry with empty fields so it can be acked', () => {
    expect(
      toStreamEntries([
        ['1-0', null],
        ['1-1', ['data', '{}']],
      ]),
    ).toEqual([
      { id: '1-0', fields: {} },
      { id: '1-1', fields: { data: '{}' } },
    ]);
  });

  it('returns no entries for a null or non-array reply', () => {
    expect(toStreamEntries(null)).toEqual([]);
    expect(toStreamEntries('nope')).toEqual([]);
  });

  it('skips malformed entries and odd trailing fields', () => {
    expect(
      toStreamEntries([
        'not-an-entry',
        [42, ['data', 'x']],
        ['2-0', ['data', 'x', 'dangling']],
      ]),
    ).toEqual([{ id: '2-0', fields: { data: 'x' } }]);
  });
});
