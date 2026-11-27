import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { HiveEngineSwap } from '@opden-data-layer/odl-db-types';

import type { Database } from '../database';
import { KYSELY } from '../database';

/**
 * Swaps in the WAIV/SWAP.HIVE pool. Literal SQL on purpose: it must match the partial index predicate
 * of migration `00081_hive_engine_swaps_waiv_pool_time` exactly (a bound parameter would not).
 */
const WAIV_POOL_SWAPS_PREDICATE = sql<boolean>`symbols @> ARRAY['WAIV', 'SWAP.HIVE']::text[]`;

/** Keyset position: rows strictly older than this `(block_timestamp, id)` pair. */
export type HiveEngineSwapKeyset = { blockTimestamp: Date; id: string };

@Injectable()
export class HiveEngineSwapsRepository {
  private readonly logger = new Logger(HiveEngineSwapsRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findWaivByAccount(
    account: string,
    limit: number,
    maxTimestampSeconds: number | null,
    dateRange?: { startDate: number; endDate: number },
  ): Promise<HiveEngineSwap[]> {
    return this.findByAccountWithSymbolFilter(
      account,
      { mode: 'waiv' },
      limit,
      maxTimestampSeconds,
      dateRange,
    );
  }

  async findByAccount(
    account: string,
    limit: number,
    maxTimestampSeconds: number | null,
  ): Promise<HiveEngineSwap[]> {
    return this.findByAccountWithSymbolFilter(
      account,
      { mode: 'all' },
      limit,
      maxTimestampSeconds,
    );
  }

  /** Every account's WAIV/SWAP.HIVE pool swaps, newest first. */
  async findWaivPoolSwaps(
    limit: number,
    before: HiveEngineSwapKeyset | null,
  ): Promise<HiveEngineSwap[]> {
    try {
      let query = this.db
        .selectFrom('hive_engine_swaps')
        .selectAll()
        .where(WAIV_POOL_SWAPS_PREDICATE);

      if (before) {
        query = query.where(
          sql<boolean>`(block_timestamp, id) < (${before.blockTimestamp}, ${before.id}::bigint)`,
        );
      }

      return await query
        .orderBy('block_timestamp', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      return [];
    }
  }

  private async findByAccountWithSymbolFilter(
    account: string,
    symbolFilter:
      | { mode: 'all' }
      | { mode: 'waiv' },
    limit: number,
    maxTimestampSeconds: number | null,
    dateRange?: { startDate: number; endDate: number },
  ): Promise<HiveEngineSwap[]> {
    try {
      let query = this.db
        .selectFrom('hive_engine_swaps')
        .selectAll()
        .where('account', '=', account);

      if (symbolFilter.mode === 'waiv') {
        query = query.where((eb) =>
          eb.or([
            eb('symbol_in', '=', 'WAIV'),
            eb('symbol_out', '=', 'WAIV'),
          ]),
        );
      }

      if (maxTimestampSeconds !== null) {
        query = query.where(
          'block_timestamp',
          '<=',
          new Date(maxTimestampSeconds * 1000),
        );
      }

      if (dateRange) {
        query = query
          .where(
            'block_timestamp',
            '>=',
            new Date(dateRange.startDate * 1000),
          )
          .where(
            'block_timestamp',
            '<=',
            new Date(dateRange.endDate * 1000),
          );
      }

      return await query
        .orderBy('block_timestamp', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .execute();
    } catch (e) {
      this.logger.error((e as Error).message);
      return [];
    }
  }
}
