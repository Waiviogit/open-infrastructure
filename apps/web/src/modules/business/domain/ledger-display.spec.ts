import {
  invoiceBadgeState,
  ledgerDetailsEntries,
  ledgerDetailsSummary,
} from './ledger-display';

describe('invoiceBadgeState', () => {
  it('maps pending invoices to "pending signature"', () => {
    expect(invoiceBadgeState('pending')).toBe('pending_signature');
    expect(invoiceBadgeState('disputed')).toBe('disputed');
    expect(invoiceBadgeState('resolved')).toBe('resolved');
    expect(invoiceBadgeState('confirmed')).toBe('confirmed');
  });
});

describe('ledgerDetailsSummary', () => {
  it('picks the first human text field and never serialises JSON', () => {
    expect(ledgerDetailsSummary({ memo: ' March retainer ', hours: 3 })).toBe(
      'March retainer',
    );
    expect(ledgerDetailsSummary({ title: 'Homepage', memo: 'x' })).toBe(
      'Homepage',
    );
    expect(ledgerDetailsSummary({ hours: 3 })).toBeNull();
    expect(ledgerDetailsSummary(undefined)).toBeNull();
  });
});

describe('ledgerDetailsEntries', () => {
  it('lists scalar values as text and nested values as JSON, skipping empties', () => {
    expect(
      ledgerDetailsEntries({
        company: 'Acme',
        hours: 12,
        empty: '',
        tags: ['a'],
      }),
    ).toEqual([
      { key: 'company', value: 'Acme' },
      { key: 'hours', value: '12' },
      { key: 'tags', value: '["a"]' },
    ]);
  });
});
