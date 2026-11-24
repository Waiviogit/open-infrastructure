import type { ChangellyCurrency } from '@opden-data-layer/clients';

import {
  buildHiveDepositCurrencies,
  changellyMicrosToIso,
  computeHiveNetAmount,
  filterHiveDepositCurrencies,
  isDepositAmountWithinLimits,
  pickDepositPairLimits,
} from './hive-changelly-deposit.mappers';

function currency(overrides: Partial<ChangellyCurrency>): ChangellyCurrency {
  return {
    ticker: 'btc',
    fullName: 'Bitcoin',
    enabled: true,
    enabledFrom: true,
    enabledTo: true,
    fixRateEnabled: true,
    payinConfirmations: 2,
    extraIdName: null,
    blockchain: 'bitcoin',
    protocol: 'BTC',
    image: null,
    payinNotification: null,
    ...overrides,
  };
}

describe('buildHiveDepositCurrencies', () => {
  it('keeps enabled pay-in coins that have a pair into HIVE, sorted by ticker', () => {
    const list = buildHiveDepositCurrencies(
      [
        currency({ ticker: 'usdtrx', fullName: 'Tether TRC20', blockchain: 'tron' }),
        currency({ ticker: 'btc' }),
        currency({ ticker: 'eth', enabledFrom: false }),
        currency({ ticker: 'ltc', enabled: false }),
        currency({ ticker: 'doge' }),
        currency({ ticker: 'hive' }),
      ],
      [
        { from: 'btc', to: 'hive' },
        { from: 'usdtrx', to: 'hive' },
        { from: 'eth', to: 'hive' },
        { from: 'ltc', to: 'hive' },
        { from: 'doge', to: 'btc' },
        { from: 'hive', to: 'hive' },
      ],
    );
    expect(list.map((row) => row.ticker)).toEqual(['btc', 'usdtrx']);
    expect(list[1]).toMatchObject({ name: 'Tether TRC20', network: 'tron' });
  });

  it('falls back to the uppercase ticker when Changelly has no name', () => {
    const [row] = buildHiveDepositCurrencies(
      [currency({ ticker: 'sol', fullName: null })],
      [{ from: 'sol', to: 'hive' }],
    );
    expect(row?.name).toBe('SOL');
  });
});

describe('filterHiveDepositCurrencies', () => {
  const list = buildHiveDepositCurrencies(
    [
      currency({ ticker: 'btc' }),
      currency({ ticker: 'usdtrx', fullName: 'Tether USD', blockchain: 'tron', protocol: 'TRC20' }),
    ],
    [
      { from: 'btc', to: 'hive' },
      { from: 'usdtrx', to: 'hive' },
    ],
  );

  it('matches ticker, name, network and protocol', () => {
    expect(filterHiveDepositCurrencies(list, 'tron').map((row) => row.ticker)).toEqual(['usdtrx']);
    expect(filterHiveDepositCurrencies(list, 'trc20').map((row) => row.ticker)).toEqual(['usdtrx']);
    expect(filterHiveDepositCurrencies(list, 'bitcoin').map((row) => row.ticker)).toEqual(['btc']);
    expect(filterHiveDepositCurrencies(list, undefined)).toHaveLength(2);
  });
});

describe('pickDepositPairLimits', () => {
  const pair = {
    from: 'btc',
    to: 'hive',
    minAmountFloat: '0.00047',
    maxAmountFloat: '0.28',
    minAmountFixed: '0.00078',
  };

  it('uses fixed limits when present and float otherwise', () => {
    expect(pickDepositPairLimits(pair, 'float')).toEqual({ min: '0.00047', max: '0.28' });
    expect(pickDepositPairLimits(pair, 'fixed')).toEqual({ min: '0.00078', max: '0.28' });
  });

  it('rejects unparsable limits', () => {
    expect(pickDepositPairLimits({ ...pair, maxAmountFloat: '' }, 'float')).toBeNull();
  });

  it('checks inclusive bounds', () => {
    const limits = { min: '0.00047', max: '0.28' };
    expect(isDepositAmountWithinLimits(0.00047, limits)).toBe(true);
    expect(isDepositAmountWithinLimits(0.28, limits)).toBe(true);
    expect(isDepositAmountWithinLimits(0.00046, limits)).toBe(false);
  });
});

describe('computeHiveNetAmount', () => {
  it('subtracts the network fee with HIVE precision and never goes negative', () => {
    expect(computeHiveNetAmount('840.471', '5.859')).toBe('834.612');
    expect(computeHiveNetAmount('3', '5.859')).toBe('0.000');
    expect(computeHiveNetAmount('10', null)).toBe('10.000');
    expect(computeHiveNetAmount(null, '1')).toBeNull();
  });
});

describe('changellyMicrosToIso', () => {
  it('converts microseconds to ISO', () => {
    expect(changellyMicrosToIso(1_700_000_000_000_000)).toBe('2023-11-14T22:13:20.000Z');
    expect(changellyMicrosToIso(null)).toBeNull();
  });
});
