import { createTranslator } from '@/i18n/domain/create-translator';

import {
  directionalUsdText,
  formatPendingBalanceLine,
  shouldShowPendingWhenSettled,
} from './directional-usd';

const t = createTranslator(
  {
    business_balance_counterparty_owes_you: '@{account} owes you {amount}',
    business_balance_you_owe_counterparty: 'You owe @{account} {amount}',
    business_balance_pending_you_owe_counterparty:
      'Pending: you owe @{account} {amount}',
  },
  'en-US',
);

describe('shouldShowPendingWhenSettled', () => {
  const confirmedSettled = {
    owesAtoB: '0.00000000',
    owesBtoA: '0.00000000',
    netUsd: '0.00000000',
  };
  const pendingOwes = {
    owesAtoB: '10.00000000',
    owesBtoA: '0.00000000',
    netUsd: '-10.00000000',
  };

  it('is true when confirmed is settled and pending is non-zero', () => {
    expect(
      shouldShowPendingWhenSettled(
        'flowmaster',
        'flowmaster',
        'shadow.hunter',
        confirmedSettled,
        pendingOwes,
      ),
    ).toBe(true);
  });

  it('is false when pending is also zero', () => {
    expect(
      shouldShowPendingWhenSettled(
        'flowmaster',
        'flowmaster',
        'shadow.hunter',
        confirmedSettled,
        confirmedSettled,
      ),
    ).toBe(false);
  });
});

describe('directionalUsdText', () => {
  it('names the counterparty who owes the viewer', () => {
    expect(directionalUsdText(12.5, 'shadow.hunter', t)).toBe(
      '@shadow.hunter owes you $12.50',
    );
  });

  it('names the counterparty the viewer owes', () => {
    expect(directionalUsdText(-3, 'shadow.hunter', t)).toBe(
      'You owe @shadow.hunter $3.00',
    );
  });

  it('falls back to the zero label', () => {
    expect(directionalUsdText(0, 'shadow.hunter', t, 'Even')).toBe('Even');
  });
});

describe('formatPendingBalanceLine', () => {
  it('fills the account and amount of a pending balance', () => {
    expect(
      formatPendingBalanceLine(
        'flowmaster',
        'shadow.hunter',
        'flowmaster',
        'shadow.hunter',
        {
          owesAtoB: '10.00000000',
          owesBtoA: '0.00000000',
          netUsd: '-10.00000000',
        },
        t,
      ),
    ).toBe('Pending: you owe @shadow.hunter $10.00');
  });
});
