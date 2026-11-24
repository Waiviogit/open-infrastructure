import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChangellyClient,
  type ChangellyClientResult,
  type ChangellyCreatedTransaction,
} from '@opden-data-layer/clients';

import { AccountsCurrentRepository } from '../../repositories';
import { ChangellyDepositCurrenciesCache } from './changelly-deposit-currencies.cache';
import {
  CHANGELLY_UNAVAILABLE_MESSAGE,
  HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
  type HiveChangellyDepositRateType,
} from './hive-changelly-deposit.constants';
import {
  computeHiveNetAmount,
  filterHiveDepositCurrencies,
  isDepositAmountWithinLimits,
  isHiveDepositFor,
  pickDepositPairLimits,
  toHiveDepositItem,
  toHiveDepositRouting,
  type DepositAmountLimits,
} from './hive-changelly-deposit.mappers';
import type {
  HiveChangellyDepositCreateBody,
  HiveChangellyDepositCreateResponse,
  HiveChangellyDepositCurrenciesQuery,
  HiveChangellyDepositCurrenciesResponse,
  HiveChangellyDepositCurrency,
  HiveChangellyDepositEstimateBody,
  HiveChangellyDepositEstimateResponse,
  HiveChangellyDepositHistoryQuery,
  HiveChangellyDepositHistoryResponse,
  HiveChangellyDepositItem,
  HiveChangellyDepositRangeQuery,
  HiveChangellyDepositRangeResponse,
} from './schemas/hive-changelly-deposit.schema';

/**
 * Changelly deposits into a Hive account (any supported coin → HIVE). Every method that takes an
 * account returns `null` when the account is unknown; Changelly failures become 503.
 */
@Injectable()
export class HiveChangellyDepositService {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly changellyClient: ChangellyClient,
    private readonly currenciesCache: ChangellyDepositCurrenciesCache,
  ) {}

  async currencies(
    query: HiveChangellyDepositCurrenciesQuery,
  ): Promise<HiveChangellyDepositCurrenciesResponse> {
    const matches = filterHiveDepositCurrencies(await this.loadCurrencies(), query.search);
    return { total: matches.length, items: matches.slice(0, query.limit) };
  }

  async range(
    accountName: string,
    query: HiveChangellyDepositRangeQuery,
  ): Promise<HiveChangellyDepositRangeResponse | null> {
    if (!(await this.findAccountName(accountName))) {
      return null;
    }
    const currency = await this.requireCurrency(query.fromCoin, query.rateType);
    const limits = await this.getLimits(currency.ticker, query.rateType);
    return { fromCoin: currency.ticker, rateType: query.rateType, ...limits };
  }

  async estimate(
    accountName: string,
    body: HiveChangellyDepositEstimateBody,
  ): Promise<HiveChangellyDepositEstimateResponse | null> {
    if (!(await this.findAccountName(accountName))) {
      return null;
    }
    const currency = await this.requireCurrency(body.fromCoin, body.rateType);
    const limits = await this.getLimits(currency.ticker, body.rateType);
    this.assertWithinLimits(body.amount, limits, currency.ticker);

    const quote =
      body.rateType === 'fixed'
        ? await this.quoteFixed(currency.ticker, body.amount)
        : await this.quoteFloat(currency.ticker, body.amount);

    return {
      fromCoin: currency.ticker,
      rateType: body.rateType,
      amountFrom: String(body.amount),
      amountTo: quote.amountTo,
      networkFee: quote.networkFee,
      amountToNet: computeHiveNetAmount(quote.amountTo, quote.networkFee) ?? quote.amountTo,
      rate: quote.rate,
      min: limits.min,
      max: limits.max,
      expiresAt: quote.expiresAt,
    };
  }

  async create(
    accountName: string,
    body: HiveChangellyDepositCreateBody,
  ): Promise<HiveChangellyDepositCreateResponse | null> {
    const destination = await this.findAccountName(accountName);
    if (!destination) {
      return null;
    }
    const currency = await this.requireCurrency(body.fromCoin, body.rateType);
    if (body.rateType === 'fixed' && !body.refundAddress) {
      throw new BadRequestException('refundAddress is required for a fixed-rate deposit');
    }
    if (body.refundAddress) {
      await this.assertRefundAddress(currency.ticker, body.refundAddress, body.refundExtraId);
    }
    const limits = await this.getLimits(currency.ticker, body.rateType);
    this.assertWithinLimits(body.amount, limits, currency.ticker);

    const created =
      body.rateType === 'fixed'
        ? await this.createFixed(currency.ticker, destination, body)
        : await this.createFloat(currency.ticker, destination, body);

    return toHiveDepositRouting({
      created,
      rateType: body.rateType,
      currency,
      destination,
      destinationMemo: body.destinationMemo,
      amount: body.amount,
    });
  }

  async status(
    accountName: string,
    exchangeId: string,
  ): Promise<HiveChangellyDepositItem | null> {
    const destination = await this.findAccountName(accountName);
    if (!destination) {
      return null;
    }
    const rows = this.unwrap(await this.changellyClient.getTransactions({ id: [exchangeId] }));
    const info = rows.find((row) => row.id === exchangeId);
    if (!info || !isHiveDepositFor(info, destination)) {
      throw new NotFoundException(`Changelly deposit not found: ${exchangeId}`);
    }
    return toHiveDepositItem(info, destination);
  }

  async history(
    accountName: string,
    query: HiveChangellyDepositHistoryQuery,
  ): Promise<HiveChangellyDepositHistoryResponse | null> {
    const destination = await this.findAccountName(accountName);
    if (!destination) {
      return null;
    }
    const rows = this.unwrap(
      await this.changellyClient.getTransactions({
        payoutAddress: [destination],
        limit: query.limit,
        offset: query.offset,
      }),
    );
    return {
      items: rows
        .filter((row) => isHiveDepositFor(row, destination))
        .map((row) => toHiveDepositItem(row, destination)),
      limit: query.limit,
      offset: query.offset,
      hasMore: rows.length >= query.limit,
    };
  }

  private async findAccountName(accountName: string): Promise<string | null> {
    const row = await this.accounts.findByName(accountName.trim().toLowerCase());
    return row?.name ?? null;
  }

  private async loadCurrencies(): Promise<HiveChangellyDepositCurrency[]> {
    const currencies = await this.currenciesCache.get();
    if (!currencies) {
      throw new ServiceUnavailableException(CHANGELLY_UNAVAILABLE_MESSAGE);
    }
    return currencies;
  }

  private async requireCurrency(
    fromCoin: string,
    rateType: HiveChangellyDepositRateType,
  ): Promise<HiveChangellyDepositCurrency> {
    const currency = (await this.loadCurrencies()).find((row) => row.ticker === fromCoin);
    if (!currency) {
      throw new BadRequestException(`Unsupported deposit coin: ${fromCoin}`);
    }
    if (rateType === 'fixed' && !currency.fixRateEnabled) {
      throw new BadRequestException(`Fixed rate is not available for ${fromCoin}`);
    }
    return currency;
  }

  private async getLimits(
    fromCoin: string,
    rateType: HiveChangellyDepositRateType,
  ): Promise<DepositAmountLimits> {
    const pair = this.unwrap(
      await this.changellyClient.getPairsParams({
        from: fromCoin,
        to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
      }),
    );
    const limits = pickDepositPairLimits(pair, rateType);
    if (!limits) {
      throw new ServiceUnavailableException(CHANGELLY_UNAVAILABLE_MESSAGE);
    }
    return limits;
  }

  private assertWithinLimits(
    amount: number,
    limits: DepositAmountLimits,
    fromCoin: string,
  ): void {
    if (!isDepositAmountWithinLimits(amount, limits)) {
      throw new BadRequestException(
        `Amount outside Changelly limits: ${limits.min}–${limits.max} ${fromCoin.toUpperCase()}`,
      );
    }
  }

  private async assertRefundAddress(
    fromCoin: string,
    address: string,
    extraId: string | undefined,
  ): Promise<void> {
    const check = this.unwrap(
      await this.changellyClient.validateAddress({ currency: fromCoin, address, extraId }),
    );
    if (!check.result) {
      throw new BadRequestException(
        `Invalid refund address for ${fromCoin}${check.message ? `: ${check.message}` : ''}`,
      );
    }
  }

  private async quoteFloat(fromCoin: string, amount: number) {
    const quote = this.unwrap(
      await this.changellyClient.getExchangeAmount({
        from: fromCoin,
        to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
        amountFrom: amount,
      }),
    );
    return {
      amountTo: quote.amountTo,
      networkFee: quote.networkFee ?? '0',
      rate: quote.rate ?? null,
      expiresAt: null,
    };
  }

  private async quoteFixed(fromCoin: string, amount: number) {
    const rate = await this.getFixRate(fromCoin, amount);
    if (!rate.amountTo) {
      throw new ServiceUnavailableException(CHANGELLY_UNAVAILABLE_MESSAGE);
    }
    return {
      amountTo: rate.amountTo,
      networkFee: rate.networkFee ?? '0',
      rate: rate.result,
      expiresAt: rate.expiredAt,
    };
  }

  private async getFixRate(fromCoin: string, amount: number) {
    const rate = this.unwrap(
      await this.changellyClient.getFixRateForAmount({
        from: fromCoin,
        to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
        amountFrom: amount,
      }),
    );
    if (!rate) {
      throw new BadRequestException('Amount outside Changelly fixed-rate limits');
    }
    return rate;
  }

  private async createFloat(
    fromCoin: string,
    destination: string,
    body: HiveChangellyDepositCreateBody,
  ): Promise<ChangellyCreatedTransaction> {
    return this.unwrap(
      await this.changellyClient.createFloatTransaction({
        from: fromCoin,
        to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
        amountFrom: body.amount,
        address: destination,
        extraId: body.destinationMemo,
        refundAddress: body.refundAddress,
        refundExtraId: body.refundExtraId,
      }),
    );
  }

  /** The rate id lives about a minute, so it is requested right before the exchange. */
  private async createFixed(
    fromCoin: string,
    destination: string,
    body: HiveChangellyDepositCreateBody,
  ): Promise<ChangellyCreatedTransaction> {
    const refundAddress = body.refundAddress;
    if (!refundAddress) {
      throw new BadRequestException('refundAddress is required for a fixed-rate deposit');
    }
    const rate = await this.getFixRate(fromCoin, body.amount);
    return this.unwrap(
      await this.changellyClient.createFixTransaction({
        from: fromCoin,
        to: HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
        rateId: rate.id,
        amountFrom: body.amount,
        address: destination,
        extraId: body.destinationMemo,
        refundAddress,
        refundExtraId: body.refundExtraId,
      }),
    );
  }

  private unwrap<T>(response: ChangellyClientResult<T>): T {
    if (response.error || response.result === undefined) {
      throw new ServiceUnavailableException(CHANGELLY_UNAVAILABLE_MESSAGE);
    }
    return response.result;
  }
}
