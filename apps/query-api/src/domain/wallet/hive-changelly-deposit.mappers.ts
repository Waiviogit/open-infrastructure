import type {
  ChangellyCreatedTransaction,
  ChangellyCurrency,
  ChangellyPair,
  ChangellyPairParams,
  ChangellyTransactionInfo,
} from '@opden-data-layer/clients';

import {
  CHANGELLY_PAYABLE_STATUSES,
  HIVE_AMOUNT_PRECISION,
  HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN,
  HIVE_CHANGELLY_DEPOSIT_PROVIDER,
  MICROSECONDS_PER_MILLISECOND,
  type HiveChangellyDepositRateType,
} from './hive-changelly-deposit.constants';
import type {
  HiveChangellyDepositCreateResponse,
  HiveChangellyDepositCurrency,
  HiveChangellyDepositItem,
} from './schemas/hive-changelly-deposit.schema';

export type DepositAmountLimits = { min: string; max: string };

/** Coins Changelly converts into HIVE: enabled as pay-in and listed in a `* → hive` pair. */
export function buildHiveDepositCurrencies(
  currencies: readonly ChangellyCurrency[],
  pairs: readonly ChangellyPair[],
): HiveChangellyDepositCurrency[] {
  const payinTickers = new Set(
    pairs
      .filter((pair) => pair.to === HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN)
      .map((pair) => pair.from),
  );
  return currencies
    .filter(
      (currency) =>
        currency.enabled &&
        currency.enabledFrom &&
        currency.ticker !== HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN &&
        payinTickers.has(currency.ticker),
    )
    .map((currency) => ({
      ticker: currency.ticker,
      name: currency.fullName ?? currency.ticker.toUpperCase(),
      network: currency.blockchain,
      protocol: currency.protocol,
      extraIdName: currency.extraIdName,
      fixRateEnabled: currency.fixRateEnabled,
      payinConfirmations: currency.payinConfirmations,
      payinNotification: currency.payinNotification,
      image: currency.image,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** `search` is already trimmed and lowercased by the query schema. */
export function filterHiveDepositCurrencies(
  currencies: readonly HiveChangellyDepositCurrency[],
  search: string | undefined,
): HiveChangellyDepositCurrency[] {
  if (!search) {
    return [...currencies];
  }
  return currencies.filter((currency) =>
    [currency.ticker, currency.name, currency.network, currency.protocol].some(
      (field) => field?.toLowerCase().includes(search) ?? false,
    ),
  );
}

export function pickDepositPairLimits(
  pair: ChangellyPairParams,
  rateType: HiveChangellyDepositRateType,
): DepositAmountLimits | null {
  const min = rateType === 'fixed' ? (pair.minAmountFixed ?? pair.minAmountFloat) : pair.minAmountFloat;
  const max = rateType === 'fixed' ? (pair.maxAmountFixed ?? pair.maxAmountFloat) : pair.maxAmountFloat;
  if (!Number.isFinite(Number.parseFloat(min)) || !Number.isFinite(Number.parseFloat(max))) {
    return null;
  }
  return { min, max };
}

export function isDepositAmountWithinLimits(
  amount: number,
  limits: DepositAmountLimits,
): boolean {
  return amount >= Number.parseFloat(limits.min) && amount <= Number.parseFloat(limits.max);
}

/** HIVE the account receives: `amountTo` minus the payout network fee, never below zero. */
export function computeHiveNetAmount(
  amountTo: string | null | undefined,
  networkFee: string | null | undefined,
): string | null {
  const gross = Number.parseFloat(amountTo ?? '');
  if (!Number.isFinite(gross)) {
    return null;
  }
  const fee = Number.parseFloat(networkFee ?? '');
  const net = gross - (Number.isFinite(fee) ? fee : 0);
  return Math.max(0, net).toFixed(HIVE_AMOUNT_PRECISION);
}

export function changellyMicrosToIso(createdAt: number | null): string | null {
  if (createdAt === null) {
    return null;
  }
  const date = new Date(Math.floor(createdAt / MICROSECONDS_PER_MILLISECOND));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A Changelly exchange that pays HIVE out to `account`. */
export function isHiveDepositFor(
  info: ChangellyTransactionInfo,
  account: string,
): boolean {
  return (
    info.currencyTo?.toLowerCase() === HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN &&
    info.payoutAddress?.toLowerCase() === account.toLowerCase()
  );
}

export function toHiveDepositRouting(input: {
  created: ChangellyCreatedTransaction;
  rateType: HiveChangellyDepositRateType;
  currency: HiveChangellyDepositCurrency;
  destination: string;
  destinationMemo: string | undefined;
  amount: number;
}): HiveChangellyDepositCreateResponse {
  const { created, currency } = input;
  return {
    provider: HIVE_CHANGELLY_DEPOSIT_PROVIDER,
    exchangeId: created.id,
    rateType: input.rateType,
    fromCoin: currency.ticker,
    network: currency.network,
    destination: input.destination,
    destinationMemo: input.destinationMemo ?? null,
    payinAddress: created.payinAddress,
    payinExtraId: created.payinExtraId,
    payinExtraIdName: currency.extraIdName,
    amountExpectedFrom: created.amountExpectedFrom ?? String(input.amount),
    amountExpectedTo: created.amountExpectedTo,
    networkFee: created.networkFee,
    amountToNet: computeHiveNetAmount(created.amountExpectedTo, created.networkFee),
    payTill: created.payTill,
    payinNotification: currency.payinNotification,
  };
}

/**
 * Status/history row. The pay-in address is shown only while the exchange still waits for the
 * payment; the pay-in hash and refund address are never shown, so these unauthenticated routes do
 * not link a sender's wallet to the Hive account.
 */
export function toHiveDepositItem(
  info: ChangellyTransactionInfo,
  destination: string,
): HiveChangellyDepositItem {
  const payable = CHANGELLY_PAYABLE_STATUSES.includes(info.status);
  return {
    exchangeId: info.id,
    status: info.status,
    rateType: info.type,
    fromCoin: info.currencyFrom,
    destination,
    payinAddress: payable ? info.payinAddress : null,
    payinExtraId: payable ? info.payinExtraId : null,
    payTill: info.payTill,
    amountExpectedFrom: info.amountExpectedFrom,
    amountExpectedTo: info.amountExpectedTo,
    amountFrom: info.amountFrom,
    amountTo: info.amountTo,
    networkFee: info.networkFee,
    payoutHash: info.payoutHash,
    createdAt: changellyMicrosToIso(info.createdAt),
  };
}
