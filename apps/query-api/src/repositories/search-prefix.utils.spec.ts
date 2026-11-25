import { escapeIlikePattern, prefixUpperBound } from './search-prefix.utils';

describe('prefixUpperBound', () => {
  it('increments last character for btree prefix upper bound', () => {
    expect(prefixUpperBound('grampo')).toBe('grampp');
  });

  it('handles dotted Hive account prefixes', () => {
    expect(prefixUpperBound('shadow.hunter')).toBe('shadow.huntes');
  });

  it('returns empty string unchanged', () => {
    expect(prefixUpperBound('')).toBe('');
  });

  it('increments last character for object_id prefix (kvu → kvv)', () => {
    expect(prefixUpperBound('kvu')).toBe('kvv');
  });

  it('increments trailing hyphen to dot (kvu- → kvu.); object_id SQL must COLLATE C', () => {
    expect(prefixUpperBound('kvu-')).toBe('kvu.');
  });
});

describe('escapeIlikePattern', () => {
  it('escapes backslash, percent and underscore', () => {
    expect(escapeIlikePattern('a\\b%c_d')).toBe('a\\\\b\\%c\\_d');
  });

  it('leaves other characters unchanged', () => {
    expect(escapeIlikePattern('shadow.hunter-1')).toBe('shadow.hunter-1');
  });
});
