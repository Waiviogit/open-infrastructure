import { accountNetUsd } from './pair-balance';

describe('accountNetUsd', () => {
  it('reads positive netUsd as account B owing account A', () => {
    expect(accountNetUsd('alice', 'alice', 'bob', '70.00000000')).toBe(70);
    expect(accountNetUsd('bob', 'alice', 'bob', '70.00000000')).toBe(-70);
  });

  it('uses netUsd even when the gross directions are clamped to zero', () => {
    expect(accountNetUsd('flowmaster', 'flowmaster', 'fesmofet', '3.00000000')).toBe(3);
    expect(accountNetUsd('fesmofet', 'flowmaster', 'fesmofet', '3.00000000')).toBe(-3);
  });

  it('treats a malformed amount as zero', () => {
    expect(accountNetUsd('alice', 'alice', 'bob', 'n/a')).toBe(0);
  });
});
