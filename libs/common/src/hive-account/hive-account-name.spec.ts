import {
  HIVE_ACCOUNT_NAME_MAX_LENGTH,
  HIVE_ACCOUNT_NAME_MIN_LENGTH,
  isHiveAccountName,
  normalizeHiveAccountInput,
} from './hive-account-name';

describe('isHiveAccountName', () => {
  it.each([
    ['abc', 'minimum length'],
    ['abcdefghijklmnop', 'maximum length'],
    ['waivio', 'plain name'],
    ['waivio.app', 'two segments'],
    ['a-b.c-d.e-f', 'dashes inside segments'],
    ['abc1', 'ends with a digit'],
    ['a1b', 'digit in the middle'],
    ['ab--c', 'double dash (hived allows it)'],
  ])('accepts %s (%s)', (name) => {
    expect(isHiveAccountName(name)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['ab', 'shorter than 3'],
    ['abcdefghijklmnopq', 'longer than 16'],
    ['a.bcd', 'segment shorter than 3'],
    ['abc.de', 'last segment shorter than 3'],
    ['abc..def', 'empty segment'],
    ['.abc', 'starts with a dot'],
    ['abc.', 'ends with a dot'],
    ['1abc', 'starts with a digit'],
    ['-abc', 'starts with a dash'],
    ['abc-', 'ends with a dash'],
    ['abc.-de', 'segment starts with a dash'],
    ['Abc', 'uppercase'],
    ['ab_c', 'underscore'],
    ['ab c', 'space'],
    ['@abc', 'not normalized'],
  ])('rejects %j (%s)', (name) => {
    expect(isHiveAccountName(name)).toBe(false);
  });

  it('exposes the length bounds', () => {
    expect(HIVE_ACCOUNT_NAME_MIN_LENGTH).toBe(3);
    expect(HIVE_ACCOUNT_NAME_MAX_LENGTH).toBe(16);
  });
});

describe('normalizeHiveAccountInput', () => {
  it.each([
    ['  Alice  ', 'alice'],
    ['@Alice', 'alice'],
    ['@@alice', 'alice'],
    [' @Waivio.App ', 'waivio.app'],
    ['alice@', 'alice@'],
    ['', ''],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeHiveAccountInput(raw)).toBe(expected);
  });

  it('makes typed input valid when the name itself is valid', () => {
    expect(isHiveAccountName(normalizeHiveAccountInput(' @Waivio.App '))).toBe(true);
  });
});
