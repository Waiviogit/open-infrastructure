import {
  buildPayOnBehalfHref,
  confirmedDebtUsd,
  parsePayOnBehalfParams,
  validatePayOnBehalfParties,
} from './pay-on-behalf';

describe('pay on behalf parties', () => {
  it('prefills debtor and receiver from the query', () => {
    expect(parsePayOnBehalfParams({ for: '@Alice', to: ' bob ' })).toEqual({
      debtor: 'alice',
      receiver: 'bob',
    });
  });

  it('treats missing query values as empty', () => {
    expect(parsePayOnBehalfParams({})).toEqual({ debtor: '', receiver: '' });
  });

  it('accepts a third party paying for the debtor', () => {
    expect(validatePayOnBehalfParties({ debtor: 'alice', receiver: 'bob' }, 'carol')).toBeNull();
  });

  it('rejects the same account as debtor and receiver', () => {
    expect(validatePayOnBehalfParties({ debtor: 'bob', receiver: 'bob' }, 'carol')).toBe(
      'debtor_is_receiver',
    );
  });

  it('rejects the receiver paying itself on behalf of the debtor', () => {
    expect(validatePayOnBehalfParties({ debtor: 'alice', receiver: 'bob' }, 'bob')).toBe(
      'viewer_is_receiver',
    );
  });

  it('rejects missing and invalid account names', () => {
    expect(validatePayOnBehalfParties({ debtor: '', receiver: 'bob' }, 'carol')).toBe(
      'missing_accounts',
    );
    expect(validatePayOnBehalfParties({ debtor: 'a b', receiver: 'bob' }, 'carol')).toBe(
      'invalid_account',
    );
  });

  it('builds a shareable link that round-trips through the parser', () => {
    const href = buildPayOnBehalfHref({ debtor: 'alice', receiver: 'bob' });
    expect(href).toBe('/business/pay?for=alice&to=bob');
    const query = Object.fromEntries(new URL(href, 'https://x').searchParams);
    expect(parsePayOnBehalfParams(query)).toEqual({ debtor: 'alice', receiver: 'bob' });
  });
});

describe('confirmedDebtUsd', () => {
  const zero = { owesAtoB: '0', owesBtoA: '0', netUsd: '0' };

  it('reads the debtor→receiver direction when the debtor is account A', () => {
    const balance = {
      accountA: 'alice',
      accountB: 'bob',
      confirmed: { owesAtoB: '100', owesBtoA: '0', netUsd: '100' },
    };
    expect(confirmedDebtUsd(balance, { debtor: 'alice', receiver: 'bob' })).toBe(100);
  });

  it('reads the debtor→receiver direction when the debtor is account B', () => {
    const balance = {
      accountA: 'alice',
      accountB: 'bob',
      confirmed: { owesAtoB: '0', owesBtoA: '7.5', netUsd: '-7.5' },
    };
    expect(confirmedDebtUsd(balance, { debtor: 'bob', receiver: 'alice' })).toBe(7.5);
  });

  it('returns 0 when the debt goes the other way or the pair does not match', () => {
    const balance = {
      accountA: 'alice',
      accountB: 'bob',
      confirmed: { owesAtoB: '0', owesBtoA: '20', netUsd: '-20' },
    };
    expect(confirmedDebtUsd(balance, { debtor: 'alice', receiver: 'bob' })).toBe(0);
    expect(
      confirmedDebtUsd({ accountA: 'x', accountB: 'y', confirmed: zero }, { debtor: 'alice', receiver: 'bob' }),
    ).toBe(0);
  });
});
