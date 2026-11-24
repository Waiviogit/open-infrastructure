import {
  mapChangellyAddressValidation,
  mapChangellyCreatedTransaction,
  mapChangellyCurrency,
  mapChangellyFixRate,
  mapChangellyPair,
  mapChangellyRows,
  mapChangellyTransactionInfo,
} from './map-changelly-records';

describe('mapChangellyCreatedTransaction', () => {
  it('normalizes a createTransaction result', () => {
    expect(
      mapChangellyCreatedTransaction({
        id: 'ex1',
        type: 'float',
        payinAddress: 'bc1qpayin',
        payinExtraId: null,
        payoutAddress: 'alice',
        payoutExtraId: '',
        amountExpectedFrom: 0.0005,
        amountExpectedTo: '840.471',
        networkFee: '5.859',
        currencyFrom: 'btc',
        currencyTo: 'hive',
        createdAt: 1763500000000000,
      }),
    ).toEqual({
      id: 'ex1',
      type: 'float',
      payinAddress: 'bc1qpayin',
      payinExtraId: null,
      payoutAddress: 'alice',
      payoutExtraId: null,
      amountExpectedFrom: '0.0005',
      amountExpectedTo: '840.471',
      networkFee: '5.859',
      payTill: null,
      currencyFrom: 'btc',
      currencyTo: 'hive',
      createdAt: 1763500000000000,
    });
  });

  it('rejects a result without id or pay-in address', () => {
    expect(mapChangellyCreatedTransaction({ id: 'ex1' })).toBeNull();
    expect(mapChangellyCreatedTransaction({ payinAddress: 'bc1q' })).toBeNull();
    expect(mapChangellyCreatedTransaction(null)).toBeNull();
    expect(mapChangellyCreatedTransaction(['ex1'])).toBeNull();
  });
});

describe('mapChangellyCurrency', () => {
  it('keeps the pay-in notification and lowercases the ticker', () => {
    expect(
      mapChangellyCurrency({
        ticker: 'USDTRX',
        fullName: 'Tether USD (TRC20)',
        enabled: true,
        enabledFrom: true,
        enabledTo: 'yes',
        fixRateEnabled: true,
        payinConfirmations: 1,
        blockchain: 'tron',
        protocol: 'TRC20',
        notifications: { payin: 'Send TRC20 only', payout: 'x' },
      }),
    ).toEqual({
      ticker: 'usdtrx',
      fullName: 'Tether USD (TRC20)',
      enabled: true,
      enabledFrom: true,
      enabledTo: false,
      fixRateEnabled: true,
      payinConfirmations: 1,
      extraIdName: null,
      blockchain: 'tron',
      protocol: 'TRC20',
      image: null,
      payinNotification: 'Send TRC20 only',
    });
  });

  it('rejects a row without ticker', () => {
    expect(mapChangellyCurrency({ fullName: 'Nameless' })).toBeNull();
  });
});

describe('mapChangellyPair', () => {
  it('lowercases both tickers and rejects partial rows', () => {
    expect(mapChangellyPair({ from: 'BTC', to: 'hive' })).toEqual({ from: 'btc', to: 'hive' });
    expect(mapChangellyPair({ from: 'btc' })).toBeNull();
  });
});

describe('mapChangellyFixRate', () => {
  it('prefers the pay-in side limits', () => {
    expect(
      mapChangellyFixRate({
        id: 'rate1',
        from: 'btc',
        to: 'hive',
        result: '1680000',
        networkFee: '5.859',
        amountFrom: '0.001',
        amountTo: '1680',
        min: '0.0007',
        minFrom: '0.00078',
        max: '0.3',
        maxFrom: '0.28',
        expiredAt: 1763500060,
      }),
    ).toEqual({
      id: 'rate1',
      from: 'btc',
      to: 'hive',
      result: '1680000',
      networkFee: '5.859',
      amountFrom: '0.001',
      amountTo: '1680',
      min: '0.00078',
      max: '0.28',
      expiredAt: 1763500060,
    });
  });
});

describe('mapChangellyTransactionInfo', () => {
  it('requires id and status', () => {
    expect(mapChangellyTransactionInfo({ id: 'ex1' })).toBeNull();
    expect(
      mapChangellyTransactionInfo({
        id: 'ex1',
        status: 'waiting',
        currencyTo: 'hive',
        payoutAddress: 'alice',
        createdAt: '1763500000000000',
      }),
    ).toMatchObject({
      id: 'ex1',
      status: 'waiting',
      currencyTo: 'hive',
      payoutAddress: 'alice',
      payinHash: null,
      createdAt: 1763500000000000,
    });
  });
});

describe('mapChangellyAddressValidation', () => {
  it('maps result and message', () => {
    expect(mapChangellyAddressValidation({ result: false, message: 'Invalid address' })).toEqual({
      result: false,
      message: 'Invalid address',
    });
    expect(mapChangellyAddressValidation({ result: 'true' })).toBeNull();
  });
});

describe('mapChangellyRows', () => {
  it('drops rows the mapper rejects and tolerates non-array results', () => {
    expect(mapChangellyRows([{ from: 'btc', to: 'hive' }, { from: 'eth' }], mapChangellyPair)).toEqual([
      { from: 'btc', to: 'hive' },
    ]);
    expect(mapChangellyRows({ from: 'btc' }, mapChangellyPair)).toEqual([]);
  });
});
