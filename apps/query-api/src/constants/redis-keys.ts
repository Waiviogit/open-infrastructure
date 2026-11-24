import { buildRedisKey, sharedRedisKey } from '@opden-data-layer/core';

const APP = 'query-api';

export const redisKey = {
  discoverTagCategories: (objectType: string) =>
    buildRedisKey(APP, 'cache', 'tag-categories', objectType),
  /** `lineageHash` is a sha256 of the category lineage (names never become key segments). */
  discoverCategories: (objectType: string, lineageHash: string) =>
    buildRedisKey(APP, 'cache', 'discover-categories', objectType, lineageHash),
  listItemCount: (parentObjectId: string, listRefId: string) =>
    buildRedisKey(APP, 'cache', 'list-count', parentObjectId, listRefId),
  objectRefExpansion: (
    parentObjectId: string,
    locale: string,
    viewerSegment: string,
    refIdsSegment: string,
  ) =>
    buildRedisKey(
      APP,
      'cache',
      'obj-refs',
      parentObjectId,
      locale,
      viewerSegment,
      refIdsSegment,
    ),
  postRewardWaivHiveRate: () =>
    buildRedisKey(APP, 'cache', 'post-reward', 'waiv-hive-usd'),
  postRewardFiatRates: (base: string) =>
    buildRedisKey(APP, 'cache', 'post-reward', 'fiat', base),
  hiveGlobalProperties: () =>
    buildRedisKey(APP, 'cache', 'hive', 'dynamic-global-properties'),
  hubFeedFilterCounts: (account: string, tab: string) =>
    buildRedisKey(APP, 'cache', 'hub-feed-filters', 'v2', account.trim().toLowerCase(), tab),
  hiveRewardFund: () => buildRedisKey(APP, 'cache', 'reward-fund', 'hive'),
  changellyDepositCurrencies: () =>
    buildRedisKey(APP, 'cache', 'changelly', 'deposit-currencies', 'v1'),
  /** Shared with chain-indexer, which deletes it on the account's profile update. */
  hiveAccount: (accountName: string) => sharedRedisKey.queryApiHiveAccount(accountName),
  waivRewardPool: () => buildRedisKey(APP, 'cache', 'waiv', 'reward-pool'),
  waivDieselPool: () => buildRedisKey(APP, 'cache', 'waiv', 'diesel-pool'),
  waivGeneratedReportLock: (reportId: string) =>
    buildRedisKey(APP, 'lock', 'waiv-generated-report', reportId),
  affiliateGovernanceCodes: (governanceObjectId: string, headerObjectId: string) =>
    buildRedisKey(
      APP,
      'cache',
      'affiliate-codes',
      'governance',
      'v2',
      governanceObjectId || 'none',
      headerObjectId || 'none',
    ),
  /** `fingerprint` hashes the generation inputs, so recipe or featured-post edits get a new link. */
  instacartRecipeLink: (objectId: string, fingerprint: string) =>
    buildRedisKey(APP, 'cache', 'instacart-recipe', objectId, fingerprint),
  /** `queryHash` is a sha256 of the normalized query (raw text never becomes a key segment). */
  placesSearch: (queryHash: string, languageCode: string, biasSegment: string) =>
    buildRedisKey(APP, 'cache', 'places', 'search', languageCode, biasSegment, queryHash),
  placeDetails: (placeId: string, languageCode: string) =>
    buildRedisKey(APP, 'cache', 'places', 'details', languageCode, placeId),
  /** Fixed-window counter per client per minute; `clientHash` is a sha256 of the IP (IPv6 has colons). */
  placesRateLimit: (clientHash: string, minuteBucket: number) =>
    buildRedisKey(APP, 'cache', 'places', 'rate', clientHash, minuteBucket),
  affiliatePersonalCodes: (
    account: string,
    governanceObjectId: string,
    headerObjectId: string,
  ) =>
    buildRedisKey(
      APP,
      'cache',
      'affiliate-codes',
      'personal',
      'v2',
      account.trim().toLowerCase(),
      governanceObjectId || 'none',
      headerObjectId || 'none',
    ),
} as const;
