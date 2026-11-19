import {
  buildLedgerPaymentAmountView,
  buildLedgerPaymentDeclaredLabel,
  canConfirmLedgerPayment,
  hasPaymentDeclaredMismatch,
} from './ledger-payment-amount';
import type { LedgerPaymentRow } from './ledger.types';

function payment(overrides: Partial<LedgerPaymentRow> = {}): LedgerPaymentRow {
  return {
    payment_id: 'pay-1',
    payer: 'alice',
    receiver: 'bob',
    amount_usd: '12.5',
    state: 'confirmed',
    method: 'offchain',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildLedgerPaymentAmountView', () => {
  it('shows an outgoing payment with a minus for the payer', () => {
    expect(buildLedgerPaymentAmountView('alice', payment())).toEqual({
      label: '−$12.50',
      direction: 'out',
    });
  });

  it('shows an incoming payment with a plus for the receiver', () => {
    expect(buildLedgerPaymentAmountView('bob', payment())).toEqual({
      label: '+$12.50',
      direction: 'in',
    });
  });

  it('has no sign when the viewer is neither party', () => {
    expect(buildLedgerPaymentAmountView('carol', payment())).toEqual({
      label: '$12.50',
      direction: 'neutral',
    });
  });

  it('keeps sub-cent curation rewards readable', () => {
    expect(
      buildLedgerPaymentAmountView('bob', payment({ amount_usd: '0.00026163' }))
        .label,
    ).toBe('+$0.00026');
  });

  it('groups thousands like every other Market amount', () => {
    expect(
      buildLedgerPaymentAmountView('alice', payment({ amount_usd: '1234567.89' }))
        .label,
    ).toBe('−$1,234,567.89');
  });
});

describe('hasPaymentDeclaredMismatch', () => {
  it('returns true when declared differs from settled amount', () => {
    expect(
      hasPaymentDeclaredMismatch(
        payment({ amount_usd: '40', declared_amount_usd: '60' }),
      ),
    ).toBe(true);
  });

  it('returns false when declared matches settled amount', () => {
    expect(
      hasPaymentDeclaredMismatch(
        payment({ amount_usd: '60', declared_amount_usd: '60' }),
      ),
    ).toBe(false);
  });

  it('falls back to amount_usd when declared is missing', () => {
    expect(hasPaymentDeclaredMismatch(payment({ amount_usd: '12.5' }))).toBe(false);
  });
});

describe('buildLedgerPaymentDeclaredLabel', () => {
  it('formats the declared amount like other Market amounts', () => {
    expect(
      buildLedgerPaymentDeclaredLabel(
        payment({ declared_amount_usd: '60', amount_usd: '40' }),
      ),
    ).toBe('$60.00');
  });
});

describe('canConfirmLedgerPayment', () => {
  it('allows receiver to confirm pending offchain declare', () => {
    expect(
      canConfirmLedgerPayment(
        payment({ state: 'pending', receiver: 'bob', method: 'offchain' }),
        'bob',
      ),
    ).toBe(true);
  });

  it('rejects confirmed or non-offchain payments', () => {
    expect(canConfirmLedgerPayment(payment({ state: 'confirmed' }), 'bob')).toBe(false);
    expect(
      canConfirmLedgerPayment(payment({ state: 'pending', method: 'onchain' }), 'bob'),
    ).toBe(false);
  });
});
