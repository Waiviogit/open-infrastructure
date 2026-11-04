import { buildOblOnBehalfMemo, parseOblOnBehalfMemo } from './obl-on-behalf-memo';

describe('OBL on-behalf memo', () => {
  it('round-trips the debtor through build and parse', () => {
    const memo = buildOblOnBehalfMemo('alice');
    expect(memo).toBe('obl:on-behalf:alice');
    expect(parseOblOnBehalfMemo(memo)).toBe('alice');
  });

  it.each(['thanks for lunch', 'obl:invoice:x', ''])('does not recognize memo %p', (memo) => {
    expect(parseOblOnBehalfMemo(memo)).toBeNull();
  });

  it('accepts surrounding whitespace', () => {
    expect(parseOblOnBehalfMemo('  obl:on-behalf:alice  ')).toBe('alice');
  });

  it.each([
    'obl:on-behalf:',
    'obl:on-behalf:Al',
    'obl:on-behalf:alice bob',
    'obl:on-behalf:__proto__',
    'obl:on-behalf:ab',
    'obl:on-behalf:alice-',
    'obl:on-behalf:abc.de',
    'obl:on-behalf:abc..def',
  ])('rejects invalid debtor name in %p', (memo) => {
    expect(parseOblOnBehalfMemo(memo)).toBeNull();
  });

  it('does not recognize the prefix in another case', () => {
    expect(parseOblOnBehalfMemo('OBL:ON-BEHALF:alice')).toBeNull();
  });

  it('accepts names of 3 and 16 chars and rejects 17 chars', () => {
    expect(parseOblOnBehalfMemo('obl:on-behalf:abc')).toBe('abc');
    expect(parseOblOnBehalfMemo(`obl:on-behalf:${'a'.repeat(16)}`)).toBe('a'.repeat(16));
    expect(parseOblOnBehalfMemo(`obl:on-behalf:${'a'.repeat(17)}`)).toBeNull();
  });

  it('accepts dotted account names', () => {
    expect(parseOblOnBehalfMemo('obl:on-behalf:abc.def')).toBe('abc.def');
  });

  it('returns null for non-string input', () => {
    expect(parseOblOnBehalfMemo(undefined)).toBeNull();
    expect(parseOblOnBehalfMemo(null)).toBeNull();
  });
});
