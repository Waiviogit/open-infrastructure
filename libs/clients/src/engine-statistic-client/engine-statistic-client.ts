import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS,
  type EngineStatisticClientModuleOptions,
} from './engine-statistic-client.options';
import type { EngineStatisticClientInterface } from './interface';

const DEFAULT_BASE = 'https://engine.waivio.com/engine-statistic';
const DEFAULT_TIMEOUT_MS = 8_000;
const USER_AGENT = 'odl-query-api';

/** Waivio engine-statistic service: per-token holder and active-account counters. */
@Injectable()
export class EngineStatisticClient implements EngineStatisticClientInterface {
  private readonly logger = new Logger(EngineStatisticClient.name);

  constructor(
    @Inject(ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS)
    private readonly options: EngineStatisticClientModuleOptions,
  ) {}

  getTokenHolderCount(symbol: string): Promise<number | null> {
    return this.getCount(symbol, 'owners');
  }

  getTokenMonthlyActiveUserCount(symbol: string): Promise<number | null> {
    return this.getCount(symbol, 'active-users');
  }

  private baseUrl(): string {
    return (this.options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  }

  private timeoutMs(): number {
    return this.options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async getCount(
    symbol: string,
    metric: 'owners' | 'active-users',
  ): Promise<number | null> {
    const url = `${this.baseUrl()}/${encodeURIComponent(symbol.toLowerCase())}/${metric}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(`engine-statistic ${metric} HTTP ${response.status}`);
        return null;
      }
      return parseCountBody(await response.json());
    } catch (e) {
      this.logger.error(`engine-statistic ${metric}: ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Body is `{ result: number }`; anything else counts as unavailable. */
export function parseCountBody(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const result = (body as { result?: unknown }).result;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < 0) {
    return null;
  }
  return Math.trunc(result);
}
