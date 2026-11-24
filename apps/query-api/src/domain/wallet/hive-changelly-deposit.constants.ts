/** Changelly payout ticker for deposits into a Hive account. */
export const HIVE_CHANGELLY_DEPOSIT_OUTPUT_COIN = 'hive';

export const HIVE_CHANGELLY_DEPOSIT_PROVIDER = 'changelly';

export const HIVE_CHANGELLY_DEPOSIT_RATE_TYPES = ['float', 'fixed'] as const;

export type HiveChangellyDepositRateType =
  (typeof HIVE_CHANGELLY_DEPOSIT_RATE_TYPES)[number];

export const HIVE_CHANGELLY_DEPOSIT_DEFAULT_RATE_TYPE: HiveChangellyDepositRateType =
  'float';

/** Hive L1 amounts carry three decimals. */
export const HIVE_AMOUNT_PRECISION = 3;

/** Hive transfer memo limit (bytes on chain; characters are checked here). */
export const HIVE_TRANSFER_MEMO_MAX_LENGTH = 2048;

export const HIVE_CHANGELLY_DEPOSIT_COIN_MAX_LENGTH = 32;

/** Longest address Changelly accepts for any chain we pass through. */
export const HIVE_CHANGELLY_DEPOSIT_ADDRESS_MAX_LENGTH = 256;

export const HIVE_CHANGELLY_EXCHANGE_ID_MAX_LENGTH = 64;

export const HIVE_CHANGELLY_DEPOSIT_CURRENCIES_DEFAULT_LIMIT = 100;

export const HIVE_CHANGELLY_DEPOSIT_CURRENCIES_MAX_LIMIT = 1000;

export const HIVE_CHANGELLY_DEPOSIT_CURRENCIES_SEARCH_MAX_LENGTH = 64;

export const HIVE_CHANGELLY_DEPOSIT_HISTORY_DEFAULT_LIMIT = 20;

/** Changelly `getTransactions` returns at most 100 rows per call. */
export const HIVE_CHANGELLY_DEPOSIT_HISTORY_MAX_LIMIT = 100;

/** Changelly statuses while the pay-in address still waits for the payment. */
export const CHANGELLY_PAYABLE_STATUSES: readonly string[] = ['new', 'waiting'];

export const CHANGELLY_UNAVAILABLE_MESSAGE = 'Changelly unavailable';

/** Changelly `createdAt` is in microseconds. */
export const MICROSECONDS_PER_MILLISECOND = 1000;
