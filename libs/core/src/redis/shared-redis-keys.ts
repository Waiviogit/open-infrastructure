import { buildRedisKey } from '@opden-data-layer/common';

/**
 * Redis keys one app writes and another app invalidates (all apps share Redis `db0`).
 * One builder, so the writer and the invalidator cannot drift apart.
 */
export const sharedRedisKey = {
  /**
   * query-api cache of a live Hive account (`get_accounts`): written by query-api, deleted by
   * chain-indexer when it indexes the account's `account_update` / `account_update2`.
   */
  queryApiHiveAccount: (accountName: string) =>
    buildRedisKey('query-api', 'cache', 'hive', 'account', accountName.trim().toLowerCase()),
} as const;
