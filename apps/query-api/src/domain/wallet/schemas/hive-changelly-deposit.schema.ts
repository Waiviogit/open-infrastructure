import { z } from 'zod';

import {
  HIVE_CHANGELLY_DEPOSIT_ADDRESS_MAX_LENGTH,
  HIVE_CHANGELLY_DEPOSIT_COIN_MAX_LENGTH,
  HIVE_CHANGELLY_DEPOSIT_CURRENCIES_DEFAULT_LIMIT,
  HIVE_CHANGELLY_DEPOSIT_CURRENCIES_MAX_LIMIT,
  HIVE_CHANGELLY_DEPOSIT_CURRENCIES_SEARCH_MAX_LENGTH,
  HIVE_CHANGELLY_DEPOSIT_DEFAULT_RATE_TYPE,
  HIVE_CHANGELLY_DEPOSIT_HISTORY_DEFAULT_LIMIT,
  HIVE_CHANGELLY_DEPOSIT_HISTORY_MAX_LIMIT,
  HIVE_CHANGELLY_DEPOSIT_PROVIDER,
  HIVE_CHANGELLY_DEPOSIT_RATE_TYPES,
  HIVE_CHANGELLY_EXCHANGE_ID_MAX_LENGTH,
  HIVE_TRANSFER_MEMO_MAX_LENGTH,
} from '../hive-changelly-deposit.constants';

const CHANGELLY_TICKER_PATTERN = /^[a-z0-9]+$/;
const CHANGELLY_EXCHANGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const hiveChangellyDepositCoinSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(HIVE_CHANGELLY_DEPOSIT_COIN_MAX_LENGTH)
  .regex(CHANGELLY_TICKER_PATTERN, 'Coin ticker must be alphanumeric')
  .describe(
    'Changelly pay-in ticker from get_hive_deposit_currencies (e.g. btc, eth, usdtrx). The ticker fixes the network.',
  );

export const hiveChangellyDepositRateTypeSchema = z
  .enum(HIVE_CHANGELLY_DEPOSIT_RATE_TYPES)
  .default(HIVE_CHANGELLY_DEPOSIT_DEFAULT_RATE_TYPE)
  .describe(
    'float (default): rate set when the payment arrives. fixed: rate locked for the pay-in window; needs refundAddress.',
  );

const optionalAddressSchema = z
  .string()
  .trim()
  .min(1)
  .max(HIVE_CHANGELLY_DEPOSIT_ADDRESS_MAX_LENGTH)
  .optional();

export const hiveChangellyDepositCurrenciesQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .toLowerCase()
    .max(HIVE_CHANGELLY_DEPOSIT_CURRENCIES_SEARCH_MAX_LENGTH)
    .optional()
    .describe('Case-insensitive substring of ticker, name, network or protocol (e.g. usdt, tron)'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(HIVE_CHANGELLY_DEPOSIT_CURRENCIES_MAX_LIMIT)
    .default(HIVE_CHANGELLY_DEPOSIT_CURRENCIES_DEFAULT_LIMIT),
});

export type HiveChangellyDepositCurrenciesQuery = z.infer<
  typeof hiveChangellyDepositCurrenciesQuerySchema
>;

export const hiveChangellyDepositCurrencySchema = z.object({
  ticker: z.string(),
  name: z.string(),
  network: z.string().nullable(),
  protocol: z.string().nullable(),
  extraIdName: z
    .string()
    .nullable()
    .describe('Name of the extra pay-in id this coin needs (Memo, Destination Tag), or null'),
  fixRateEnabled: z.boolean(),
  payinConfirmations: z.number().nullable(),
  payinNotification: z.string().nullable(),
  image: z.string().nullable(),
});

export type HiveChangellyDepositCurrency = z.infer<
  typeof hiveChangellyDepositCurrencySchema
>;

export const hiveChangellyDepositCurrencyListSchema = z.array(
  hiveChangellyDepositCurrencySchema,
);

export const hiveChangellyDepositCurrenciesResponseSchema = z.object({
  total: z.number().int().describe('Matches before limit'),
  items: hiveChangellyDepositCurrencyListSchema,
});

export type HiveChangellyDepositCurrenciesResponse = z.infer<
  typeof hiveChangellyDepositCurrenciesResponseSchema
>;

export const hiveChangellyDepositRangeQuerySchema = z.object({
  fromCoin: hiveChangellyDepositCoinSchema,
  rateType: hiveChangellyDepositRateTypeSchema,
});

export type HiveChangellyDepositRangeQuery = z.infer<
  typeof hiveChangellyDepositRangeQuerySchema
>;

export const hiveChangellyDepositRangeResponseSchema = z.object({
  fromCoin: z.string(),
  rateType: z.enum(HIVE_CHANGELLY_DEPOSIT_RATE_TYPES),
  min: z.string().describe('Minimum pay-in amount in fromCoin'),
  max: z.string().describe('Maximum pay-in amount in fromCoin'),
});

export type HiveChangellyDepositRangeResponse = z.infer<
  typeof hiveChangellyDepositRangeResponseSchema
>;

export const hiveChangellyDepositEstimateBodySchema = z.object({
  fromCoin: hiveChangellyDepositCoinSchema,
  amount: z.coerce.number().positive().describe('Pay-in amount in fromCoin'),
  rateType: hiveChangellyDepositRateTypeSchema,
});

export type HiveChangellyDepositEstimateBody = z.infer<
  typeof hiveChangellyDepositEstimateBodySchema
>;

export const hiveChangellyDepositEstimateResponseSchema = z.object({
  fromCoin: z.string(),
  rateType: z.enum(HIVE_CHANGELLY_DEPOSIT_RATE_TYPES),
  amountFrom: z.string(),
  amountTo: z.string().describe('HIVE before the payout network fee'),
  networkFee: z.string().describe('Payout network fee in HIVE'),
  amountToNet: z.string().describe('HIVE the account receives (amountTo − networkFee)'),
  rate: z.string().nullable(),
  min: z.string(),
  max: z.string(),
  expiresAt: z
    .number()
    .nullable()
    .describe('Fixed rate quote expiry (unix seconds); create re-quotes, so this is informational'),
});

export type HiveChangellyDepositEstimateResponse = z.infer<
  typeof hiveChangellyDepositEstimateResponseSchema
>;

export const hiveChangellyDepositCreateBodySchema = z.object({
  fromCoin: hiveChangellyDepositCoinSchema,
  amount: z.coerce.number().positive().describe('Pay-in amount in fromCoin'),
  rateType: hiveChangellyDepositRateTypeSchema,
  refundAddress: optionalAddressSchema.describe(
    'Sender wallet on the fromCoin network for refunds. Required for fixed rate.',
  ),
  refundExtraId: optionalAddressSchema.describe('Extra id (memo/tag) for refundAddress'),
  destinationMemo: z
    .string()
    .trim()
    .min(1)
    .max(HIVE_TRANSFER_MEMO_MAX_LENGTH)
    .optional()
    .describe('Hive memo for the payout; needed only when the account is an exchange or swap gateway'),
});

export type HiveChangellyDepositCreateBody = z.infer<
  typeof hiveChangellyDepositCreateBodySchema
>;

export const hiveChangellyDepositCreateResponseSchema = z.object({
  provider: z.literal(HIVE_CHANGELLY_DEPOSIT_PROVIDER),
  exchangeId: z.string(),
  rateType: z.enum(HIVE_CHANGELLY_DEPOSIT_RATE_TYPES),
  fromCoin: z.string(),
  network: z.string().nullable(),
  destination: z.string().describe('Hive account that receives HIVE'),
  destinationMemo: z.string().nullable(),
  payinAddress: z.string().describe('Address the sender pays fromCoin to'),
  payinExtraId: z
    .string()
    .nullable()
    .describe('Must be sent with the payment when not null'),
  payinExtraIdName: z.string().nullable(),
  amountExpectedFrom: z.string().nullable(),
  amountExpectedTo: z.string().nullable().describe('HIVE before the payout network fee'),
  networkFee: z.string().nullable(),
  amountToNet: z.string().nullable(),
  payTill: z.string().nullable().describe('Fixed rate payment deadline'),
  payinNotification: z.string().nullable(),
});

export type HiveChangellyDepositCreateResponse = z.infer<
  typeof hiveChangellyDepositCreateResponseSchema
>;

export const hiveChangellyDepositStatusParamsSchema = z.object({
  exchangeId: z
    .string()
    .trim()
    .min(1)
    .max(HIVE_CHANGELLY_EXCHANGE_ID_MAX_LENGTH)
    .regex(CHANGELLY_EXCHANGE_ID_PATTERN, 'Invalid exchange id')
    .describe('Changelly exchange id from create or history'),
});

export type HiveChangellyDepositStatusParams = z.infer<
  typeof hiveChangellyDepositStatusParamsSchema
>;

export const hiveChangellyDepositItemSchema = z.object({
  exchangeId: z.string(),
  status: z
    .string()
    .describe(
      'waiting, confirming, exchanging, sending, finished, failed, refunded, hold, overdue, expired',
    ),
  rateType: z.string().nullable(),
  fromCoin: z.string().nullable(),
  destination: z.string(),
  payinAddress: z
    .string()
    .nullable()
    .describe('Only while the exchange still waits for the payment'),
  payinExtraId: z.string().nullable().describe('Only while the exchange still waits for the payment'),
  payTill: z.string().nullable(),
  amountExpectedFrom: z.string().nullable(),
  amountExpectedTo: z.string().nullable(),
  amountFrom: z.string().nullable(),
  amountTo: z.string().nullable(),
  networkFee: z.string().nullable(),
  payoutHash: z.string().nullable().describe('Hive transaction id of the payout'),
  createdAt: z.string().nullable(),
});

export type HiveChangellyDepositItem = z.infer<typeof hiveChangellyDepositItemSchema>;

export const hiveChangellyDepositHistoryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(HIVE_CHANGELLY_DEPOSIT_HISTORY_MAX_LIMIT)
    .default(HIVE_CHANGELLY_DEPOSIT_HISTORY_DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export type HiveChangellyDepositHistoryQuery = z.infer<
  typeof hiveChangellyDepositHistoryQuerySchema
>;

export const hiveChangellyDepositHistoryResponseSchema = z.object({
  items: z.array(hiveChangellyDepositItemSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export type HiveChangellyDepositHistoryResponse = z.infer<
  typeof hiveChangellyDepositHistoryResponseSchema
>;
