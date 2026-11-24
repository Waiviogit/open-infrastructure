import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ChangellyClient, ChangellyTransactionInfo } from '@opden-data-layer/clients';

import type { AccountsCurrentRepository } from '../../repositories';
import type { ChangellyDepositCurrenciesCache } from './changelly-deposit-currencies.cache';
import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type { HiveChangellyDepositCurrency } from './schemas/hive-changelly-deposit.schema';

const BTC: HiveChangellyDepositCurrency = {
  ticker: 'btc',
  name: 'Bitcoin',
  network: 'bitcoin',
  protocol: 'BTC',
  extraIdName: null,
  fixRateEnabled: true,
  payinConfirmations: 2,
  payinNotification: null,
  image: null,
};

const XRP: HiveChangellyDepositCurrency = {
  ...BTC,
  ticker: 'xrp',
  name: 'Ripple',
  network: 'ripple',
  protocol: 'XRP',
  extraIdName: 'Destination Tag',
  fixRateEnabled: false,
};

const CREATED = {
  id: 'ex1',
  type: 'float',
  payinAddress: 'bc1qpayin',
  payinExtraId: null,
  payoutAddress: 'bob',
  payoutExtraId: null,
  amountExpectedFrom: '0.0005',
  amountExpectedTo: '840.471',
  networkFee: '5.859',
  payTill: null,
  currencyFrom: 'btc',
  currencyTo: 'hive',
  createdAt: 1763500000000000,
};

function txInfo(overrides: Partial<ChangellyTransactionInfo>): ChangellyTransactionInfo {
  return {
    id: 'ex1',
    status: 'waiting',
    type: 'float',
    currencyFrom: 'btc',
    currencyTo: 'hive',
    payinAddress: 'bc1qpayin',
    payinExtraId: null,
    payinHash: 'btc-tx-hash',
    payoutAddress: 'bob',
    payoutExtraId: null,
    payoutHash: null,
    payoutHashLink: null,
    amountFrom: null,
    amountTo: null,
    amountExpectedFrom: '0.0005',
    amountExpectedTo: '840.471',
    networkFee: '5.859',
    payTill: null,
    createdAt: 1763500000000000,
    ...overrides,
  };
}

describe('HiveChangellyDepositService', () => {
  const accounts = { findByName: jest.fn() };
  const currenciesCache = { get: jest.fn() };
  const changellyClient = {
    getPairsParams: jest.fn(),
    getExchangeAmount: jest.fn(),
    getFixRateForAmount: jest.fn(),
    createFloatTransaction: jest.fn(),
    createFixTransaction: jest.fn(),
    getTransactions: jest.fn(),
    validateAddress: jest.fn(),
  };
  let service: HiveChangellyDepositService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HiveChangellyDepositService(
      accounts as unknown as AccountsCurrentRepository,
      changellyClient as unknown as ChangellyClient,
      currenciesCache as unknown as ChangellyDepositCurrenciesCache,
    );
    accounts.findByName.mockResolvedValue({ name: 'bob' });
    currenciesCache.get.mockResolvedValue([BTC, XRP]);
    changellyClient.getPairsParams.mockResolvedValue({
      result: {
        from: 'btc',
        to: 'hive',
        minAmountFloat: '0.00047',
        maxAmountFloat: '0.28',
        minAmountFixed: '0.00078',
        maxAmountFixed: '0.27',
      },
    });
    changellyClient.validateAddress.mockResolvedValue({ result: { result: true, message: null } });
    changellyClient.createFloatTransaction.mockResolvedValue({ result: CREATED });
  });

  describe('currencies', () => {
    it('filters by search and reports the total before limit', async () => {
      await expect(service.currencies({ search: 'ripple', limit: 100 })).resolves.toEqual({
        total: 1,
        items: [XRP],
      });
      await expect(service.currencies({ limit: 1 })).resolves.toEqual({
        total: 2,
        items: [BTC],
      });
    });

    it('is unavailable when Changelly cannot list coins', async () => {
      currenciesCache.get.mockResolvedValue(null);
      await expect(service.currencies({ limit: 10 })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('range', () => {
    it('returns null for an unknown account', async () => {
      accounts.findByName.mockResolvedValue(undefined);
      await expect(
        service.range('ghost', { fromCoin: 'btc', rateType: 'float' }),
      ).resolves.toBeNull();
    });

    it('uses fixed limits for the fixed rate', async () => {
      await expect(service.range('bob', { fromCoin: 'btc', rateType: 'fixed' })).resolves.toEqual({
        fromCoin: 'btc',
        rateType: 'fixed',
        min: '0.00078',
        max: '0.27',
      });
      expect(changellyClient.getPairsParams).toHaveBeenCalledWith({ from: 'btc', to: 'hive' });
    });

    it('rejects a coin without fixed rate and an unknown coin', async () => {
      await expect(
        service.range('bob', { fromCoin: 'xrp', rateType: 'fixed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.range('bob', { fromCoin: 'doge', rateType: 'float' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('estimate', () => {
    it('subtracts the payout network fee for the float rate', async () => {
      changellyClient.getExchangeAmount.mockResolvedValue({
        result: { amountTo: '840.471', networkFee: '5.859', rate: '1682624' },
      });
      await expect(
        service.estimate('bob', { fromCoin: 'btc', amount: 0.0005, rateType: 'float' }),
      ).resolves.toEqual({
        fromCoin: 'btc',
        rateType: 'float',
        amountFrom: '0.0005',
        amountTo: '840.471',
        networkFee: '5.859',
        amountToNet: '834.612',
        rate: '1682624',
        min: '0.00047',
        max: '0.28',
        expiresAt: null,
      });
    });

    it('rejects an amount below the minimum before quoting', async () => {
      await expect(
        service.estimate('bob', { fromCoin: 'btc', amount: 0.0001, rateType: 'float' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(changellyClient.getExchangeAmount).not.toHaveBeenCalled();
    });

    it('treats an empty fixed quote as outside the limits', async () => {
      changellyClient.getFixRateForAmount.mockResolvedValue({ result: null });
      await expect(
        service.estimate('bob', { fromCoin: 'btc', amount: 0.001, rateType: 'fixed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create', () => {
    it('creates a float exchange paying HIVE to the account', async () => {
      await expect(
        service.create('Bob', { fromCoin: 'btc', amount: 0.0005, rateType: 'float' }),
      ).resolves.toEqual({
        provider: 'changelly',
        exchangeId: 'ex1',
        rateType: 'float',
        fromCoin: 'btc',
        network: 'bitcoin',
        destination: 'bob',
        destinationMemo: null,
        payinAddress: 'bc1qpayin',
        payinExtraId: null,
        payinExtraIdName: null,
        amountExpectedFrom: '0.0005',
        amountExpectedTo: '840.471',
        networkFee: '5.859',
        amountToNet: '834.612',
        payTill: null,
        payinNotification: null,
      });
      expect(accounts.findByName).toHaveBeenCalledWith('bob');
      expect(changellyClient.createFloatTransaction).toHaveBeenCalledWith({
        from: 'btc',
        to: 'hive',
        amountFrom: 0.0005,
        address: 'bob',
        extraId: undefined,
        refundAddress: undefined,
        refundExtraId: undefined,
      });
      expect(changellyClient.validateAddress).not.toHaveBeenCalled();
    });

    it('requires a refund address for the fixed rate', async () => {
      await expect(
        service.create('bob', { fromCoin: 'btc', amount: 0.001, rateType: 'fixed' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(changellyClient.createFixTransaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid refund address', async () => {
      changellyClient.validateAddress.mockResolvedValue({
        result: { result: false, message: 'Invalid address' },
      });
      await expect(
        service.create('bob', {
          fromCoin: 'btc',
          amount: 0.0005,
          rateType: 'float',
          refundAddress: 'nope',
        }),
      ).rejects.toThrow('Invalid refund address for btc: Invalid address');
      expect(changellyClient.createFloatTransaction).not.toHaveBeenCalled();
    });

    it('quotes a fresh rate id right before a fixed exchange', async () => {
      changellyClient.getFixRateForAmount.mockResolvedValue({
        result: { id: 'rate1', amountTo: '1680', networkFee: '5.859', result: '1680000' },
      });
      changellyClient.createFixTransaction.mockResolvedValue({
        result: { ...CREATED, type: 'fixed', payTill: '2026-11-24T12:15:00.000Z' },
      });
      const routing = await service.create('bob', {
        fromCoin: 'btc',
        amount: 0.001,
        rateType: 'fixed',
        refundAddress: 'bc1qrefund',
        destinationMemo: 'deposit-42',
      });
      expect(changellyClient.createFixTransaction).toHaveBeenCalledWith({
        from: 'btc',
        to: 'hive',
        rateId: 'rate1',
        amountFrom: 0.001,
        address: 'bob',
        extraId: 'deposit-42',
        refundAddress: 'bc1qrefund',
        refundExtraId: undefined,
      });
      expect(routing).toMatchObject({
        rateType: 'fixed',
        destinationMemo: 'deposit-42',
        payTill: '2026-11-24T12:15:00.000Z',
      });
    });

    it('maps a Changelly failure to 503', async () => {
      changellyClient.createFloatTransaction.mockResolvedValue({
        error: { message: 'Changelly unavailable' },
      });
      await expect(
        service.create('bob', { fromCoin: 'btc', amount: 0.0005, rateType: 'float' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('status', () => {
    it('hides the pay-in hash and shows the pay-in address while waiting', async () => {
      changellyClient.getTransactions.mockResolvedValue({ result: [txInfo({})] });
      const item = await service.status('bob', 'ex1');
      expect(item).toMatchObject({
        exchangeId: 'ex1',
        status: 'waiting',
        destination: 'bob',
        payinAddress: 'bc1qpayin',
        createdAt: '2025-11-18T21:06:40.000Z',
      });
      expect(item).not.toHaveProperty('payinHash');
      expect(changellyClient.getTransactions).toHaveBeenCalledWith({ id: ['ex1'] });
    });

    it('drops the pay-in address once the payment arrived', async () => {
      changellyClient.getTransactions.mockResolvedValue({
        result: [txInfo({ status: 'finished', payoutHash: 'hive-tx' })],
      });
      await expect(service.status('bob', 'ex1')).resolves.toMatchObject({
        status: 'finished',
        payinAddress: null,
        payoutHash: 'hive-tx',
      });
    });

    it('is not found when the exchange pays another account', async () => {
      changellyClient.getTransactions.mockResolvedValue({
        result: [txInfo({ payoutAddress: 'mallory' })],
      });
      await expect(service.status('bob', 'ex1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('history', () => {
    it('lists HIVE payouts to the account', async () => {
      changellyClient.getTransactions.mockResolvedValue({
        result: [txInfo({}), txInfo({ id: 'ex2', currencyTo: 'eos' })],
      });
      const page = await service.history('bob', { limit: 2, offset: 0 });
      expect(changellyClient.getTransactions).toHaveBeenCalledWith({
        payoutAddress: ['bob'],
        limit: 2,
        offset: 0,
      });
      expect(page?.items.map((item) => item.exchangeId)).toEqual(['ex1']);
      expect(page?.hasMore).toBe(true);
    });
  });
});
