export const ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS = Symbol(
  'ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS',
);

export type EngineStatisticClientModuleOptions = {
  /** Origin + path prefix, e.g. `https://engine.waivio.com/engine-statistic`. */
  baseUrl?: string;
  requestTimeoutMs?: number;
};
