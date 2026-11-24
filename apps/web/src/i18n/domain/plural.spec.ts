import { pluralKeyCandidates } from './plural';

describe('pluralKeyCandidates', () => {
  it('uses one/other for English', () => {
    expect(pluralKeyCandidates('items', 1, 'en-US')).toEqual(['items_one', 'items_other']);
    expect(pluralKeyCandidates('items', 5, 'en-US')).toEqual(['items_other']);
  });

  it('tries the zero override first for a count of 0', () => {
    expect(pluralKeyCandidates('items', 0, 'en-US')).toEqual(['items_zero', 'items_other']);
  });

  it('uses CLDR categories for Russian', () => {
    expect(pluralKeyCandidates('items', 1, 'ru-RU')[0]).toBe('items_one');
    expect(pluralKeyCandidates('items', 2, 'ru-RU')[0]).toBe('items_few');
    expect(pluralKeyCandidates('items', 5, 'ru-RU')[0]).toBe('items_many');
    expect(pluralKeyCandidates('items', 21, 'ru-RU')[0]).toBe('items_one');
  });

  it('uses all six categories for Arabic', () => {
    expect(pluralKeyCandidates('items', 0, 'ar-SA')).toEqual(['items_zero', 'items_other']);
    expect(pluralKeyCandidates('items', 2, 'ar-SA')[0]).toBe('items_two');
    expect(pluralKeyCandidates('items', 3, 'ar-SA')[0]).toBe('items_few');
    expect(pluralKeyCandidates('items', 11, 'ar-SA')[0]).toBe('items_many');
    expect(pluralKeyCandidates('items', 100, 'ar-SA')[0]).toBe('items_other');
  });

  it('has only other for Japanese', () => {
    expect(pluralKeyCandidates('items', 1, 'ja-JP')).toEqual(['items_other']);
  });
});
