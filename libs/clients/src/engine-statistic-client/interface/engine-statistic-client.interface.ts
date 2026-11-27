export interface EngineStatisticClientInterface {
  /** Number of accounts holding the token (liquid or staked), or null when unavailable. */
  getTokenHolderCount(symbol: string): Promise<number | null>;
  /** Accounts active with the token over the last month, or null when unavailable. */
  getTokenMonthlyActiveUserCount(symbol: string): Promise<number | null>;
}
