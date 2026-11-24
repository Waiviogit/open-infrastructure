import { createTranslator } from '@/i18n/domain/create-translator';

import {
  computePowerDownInstallmentAmount,
  computePowerDownPeriodDays,
  computeWeeklyPowerDownUnlock,
  formatPowerDownUnlockPreview,
  getWalletPowerDownWeeks,
  HIVE_POWER_DOWN_WEEKS,
  resolveEnginePowerDownMeta,
  roundPowerDownPeriodDays,
  WAIV_POWER_DOWN_WEEKS,
} from './wallet-power-schedule';

describe('getWalletPowerDownWeeks', () => {
  it('returns 13 for HIVE', () => {
    expect(getWalletPowerDownWeeks('HIVE')).toBe(HIVE_POWER_DOWN_WEEKS);
  });

  it('returns 4 for WAIV and other engine assets', () => {
    expect(getWalletPowerDownWeeks('WAIV')).toBe(WAIV_POWER_DOWN_WEEKS);
    expect(getWalletPowerDownWeeks('BEE')).toBe(WAIV_POWER_DOWN_WEEKS);
  });
});

describe('computeWeeklyPowerDownUnlock', () => {
  it('divides amount by weeks and formats', () => {
    expect(computeWeeklyPowerDownUnlock(100, 4)).toBe('25');
  });

  it('returns null for invalid input', () => {
    expect(computeWeeklyPowerDownUnlock(null, 4)).toBeNull();
    expect(computeWeeklyPowerDownUnlock(0, 4)).toBeNull();
    expect(computeWeeklyPowerDownUnlock(100, 0)).toBeNull();
  });
});

describe('computePowerDownInstallmentAmount', () => {
  it('divides by numberTransactions', () => {
    expect(computePowerDownInstallmentAmount(10, 5)).toBe('2');
  });

  it('returns null when numberTransactions is invalid', () => {
    expect(computePowerDownInstallmentAmount(10, 0)).toBeNull();
  });
});

describe('computePowerDownPeriodDays', () => {
  it('returns cooldown divided by transactions', () => {
    expect(computePowerDownPeriodDays(28, 4)).toBe(7);
    expect(computePowerDownPeriodDays(10, 5)).toBe(2);
  });
});

describe('resolveEnginePowerDownMeta', () => {
  it('coerces string fields from API', () => {
    expect(
      resolveEnginePowerDownMeta({
        unstakingCooldown: '28',
        numberTransactions: '4',
      }),
    ).toEqual({ unstakingCooldown: 28, numberTransactions: 4 });
  });

  it('infers weekly installments when numberTransactions is missing', () => {
    expect(
      resolveEnginePowerDownMeta({ unstakingCooldown: 28, numberTransactions: 0 }),
    ).toEqual({ unstakingCooldown: 28, numberTransactions: 4 });
  });
});

describe('roundPowerDownPeriodDays', () => {
  it('keeps whole days', () => {
    expect(roundPowerDownPeriodDays(2)).toBe(2);
  });

  it('truncates fractional days to the wallet display precision', () => {
    expect(roundPowerDownPeriodDays(7 / 3)).toBe(2.333);
  });
});

describe('formatPowerDownUnlockPreview', () => {
  const translate = createTranslator(
    {
      wallet_power_unlock_weekly: '{amount} {symbol} every week',
      wallet_power_unlock_every_days_one: '{amount} {symbol} every day',
      wallet_power_unlock_every_days_other:
        '{amount} {symbol} every {count} days',
    },
    'en-US',
  );

  it('uses weekly copy for POB-like metadata (28/4)', () => {
    const result = formatPowerDownUnlockPreview({
      asset: 'POB',
      parsedAmount: 40,
      liquidSymbol: 'POB',
      engineMeta: { unstakingCooldown: 28, numberTransactions: 4 },
      translate,
    });
    expect(result).toBe('10 POB every week');
  });

  it('uses weekly copy for WAIV', () => {
    expect(
      formatPowerDownUnlockPreview({
        asset: 'WAIV',
        parsedAmount: 40,
        liquidSymbol: 'WAIV',
        translate,
      }),
    ).toBe('10 WAIV every week');
  });

  it('uses weekly copy when period is 7 days', () => {
    const result = formatPowerDownUnlockPreview({
      asset: 'BEE',
      parsedAmount: 8,
      liquidSymbol: 'BEE',
      engineMeta: { unstakingCooldown: 14, numberTransactions: 2 },
      translate,
    });
    expect(result).toBe('4 BEE every week');
  });

  it('uses every-days copy for non-weekly HE schedules', () => {
    const result = formatPowerDownUnlockPreview({
      asset: 'BEE',
      parsedAmount: 10,
      liquidSymbol: 'BEE',
      engineMeta: { unstakingCooldown: 10, numberTransactions: 5 },
      translate,
    });
    expect(result).toBe('2 BEE every 2 days');
  });

  it('picks the singular form for a one-day period', () => {
    const result = formatPowerDownUnlockPreview({
      asset: 'BEE',
      parsedAmount: 9,
      liquidSymbol: 'BEE',
      engineMeta: { unstakingCooldown: 3, numberTransactions: 3 },
      translate,
    });
    expect(result).toBe('3 BEE every day');
  });

  it('shows fractional periods at the wallet display precision', () => {
    const result = formatPowerDownUnlockPreview({
      asset: 'BEE',
      parsedAmount: 9,
      liquidSymbol: 'BEE',
      engineMeta: { unstakingCooldown: 7, numberTransactions: 3 },
      translate,
    });
    expect(result).toBe('3 BEE every 2.333 days');
  });
});
