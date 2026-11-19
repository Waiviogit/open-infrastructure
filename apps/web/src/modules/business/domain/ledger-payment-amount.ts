import type { LedgerPaymentRow } from './ledger.types';
import { formatUsd, parseUsdAmount } from './usd-format';

export type LedgerPaymentDirection = 'out' | 'in' | 'neutral';

/** A ledger payment amount as the viewer reads it: `−$100.00` sent, `+$100.00` received. */
export type LedgerPaymentAmountView = {
  label: string;
  direction: LedgerPaymentDirection;
};

function paymentDeclaredAmount(payment: LedgerPaymentRow): string {
  return payment.declared_amount_usd ?? payment.amount_usd;
}

export function hasPaymentDeclaredMismatch(payment: LedgerPaymentRow): boolean {
  const declared = paymentDeclaredAmount(payment);
  const settled = payment.amount_usd;
  const declaredNum = Number.parseFloat(declared);
  const settledNum = Number.parseFloat(settled);
  if (!Number.isFinite(declaredNum) || !Number.isFinite(settledNum)) {
    return declared !== settled;
  }
  return declaredNum !== settledNum;
}

/** The amount the payer declared, when it differs from what the receiver confirmed. */
export function buildLedgerPaymentDeclaredLabel(payment: LedgerPaymentRow): string {
  return formatUsd(paymentDeclaredAmount(payment), { precise: true });
}

export function buildLedgerPaymentAmountView(
  viewer: string,
  payment: LedgerPaymentRow,
): LedgerPaymentAmountView {
  const amount = parseUsdAmount(payment.amount_usd);
  if (amount === null) {
    return { label: formatUsd(null), direction: 'neutral' };
  }
  if (payment.payer === viewer) {
    return { label: formatUsd(-amount, { precise: true }), direction: 'out' };
  }
  if (payment.receiver === viewer) {
    return {
      label: formatUsd(amount, { precise: true, signed: true }),
      direction: 'in',
    };
  }
  return { label: formatUsd(amount, { precise: true }), direction: 'neutral' };
}

export function canConfirmLedgerPayment(
  pay: LedgerPaymentRow,
  username: string,
): boolean {
  return pay.state === 'pending' && pay.receiver === username && pay.method === 'offchain';
}
