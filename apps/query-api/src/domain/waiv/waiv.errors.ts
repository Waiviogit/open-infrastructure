/** Hive Engine did not answer for the WAIV token or its development fund. */
export class WaivStatsUnavailableError extends Error {
  constructor() {
    super('WAIV stats unavailable: Hive Engine did not respond');
    this.name = 'WaivStatsUnavailableError';
  }
}

/** The swaps cursor was not issued by this API. */
export class InvalidWaivSwapsCursorError extends Error {
  constructor() {
    super('Invalid swaps cursor');
    this.name = 'InvalidWaivSwapsCursorError';
  }
}
