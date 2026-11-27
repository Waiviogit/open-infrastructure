import {
  BadRequestException,
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  GetWaivStatsEndpoint,
  GetWaivSwapsEndpoint,
  InvalidWaivSwapsCursorError,
  WaivStatsUnavailableError,
  waivSwapsQuerySchema,
  type WaivStatsResponse,
  type WaivSwapsQuery,
  type WaivSwapsResponse,
} from '../domain/waiv';
import { ZodQueryPipe } from '../pipes';

/** WAIV token page: stats and the pool-wide swap history. Price chart: `GET /currency/engine/chart`. */
@Controller({ path: 'waiv', version: '1' })
export class WaivController {
  constructor(
    private readonly getWaivStats: GetWaivStatsEndpoint,
    private readonly getWaivSwaps: GetWaivSwapsEndpoint,
  ) {}

  @Get('stats')
  async stats(): Promise<WaivStatsResponse> {
    try {
      return await this.getWaivStats.execute();
    } catch (e) {
      if (e instanceof WaivStatsUnavailableError) {
        throw new ServiceUnavailableException('Hive Engine unavailable');
      }
      throw e;
    }
  }

  @Get('swaps')
  async swaps(
    @Query(new ZodQueryPipe(waivSwapsQuerySchema)) query: WaivSwapsQuery,
  ): Promise<WaivSwapsResponse> {
    try {
      return await this.getWaivSwaps.execute(query);
    } catch (e) {
      if (e instanceof InvalidWaivSwapsCursorError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
  }
}
