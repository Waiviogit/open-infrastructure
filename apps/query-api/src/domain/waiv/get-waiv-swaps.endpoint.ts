import { Injectable } from '@nestjs/common';
import type { HiveEngineSwap } from '@opden-data-layer/odl-db-types';

import { AccountsCurrentRepository, HiveEngineSwapsRepository } from '../../repositories';
import { loadAccountAvatarUrls } from '../users/load-account-avatar-urls';
import type { WaivSwapItem, WaivSwapsQuery, WaivSwapsResponse } from './schemas/waiv.schema';
import { decodeWaivSwapsCursor, encodeWaivSwapsCursor } from './waiv-swaps-cursor';
import { InvalidWaivSwapsCursorError } from './waiv.errors';

function toSwapItem(row: HiveEngineSwap, avatarUrl: string | null): WaivSwapItem {
  return {
    id: String(row.id),
    account: row.account,
    avatarUrl,
    transactionId: row.transaction_id,
    blockNumber: row.block_number,
    timestamp: new Date(row.block_timestamp).toISOString(),
    symbolIn: row.symbol_in,
    symbolInQuantity: row.symbol_in_quantity,
    symbolOut: row.symbol_out,
    symbolOutQuantity: row.symbol_out_quantity,
  };
}

/** Swap history of every account in the WAIV/SWAP.HIVE pool, newest first. */
@Injectable()
export class GetWaivSwapsEndpoint {
  constructor(
    private readonly swaps: HiveEngineSwapsRepository,
    private readonly accounts: AccountsCurrentRepository,
  ) {}

  /** @throws {InvalidWaivSwapsCursorError} for a cursor this API did not issue. */
  async execute(query: WaivSwapsQuery): Promise<WaivSwapsResponse> {
    const before = query.cursor ? decodeWaivSwapsCursor(query.cursor) : null;
    if (query.cursor && !before) {
      throw new InvalidWaivSwapsCursorError();
    }

    const rows = await this.swaps.findWaivPoolSwaps(query.limit + 1, before);
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const avatars = await loadAccountAvatarUrls(
      this.accounts,
      page.map((row) => row.account),
    );

    const last = page.at(-1);
    return {
      items: page.map((row) => toSwapItem(row, avatars.get(row.account) ?? null)),
      cursor:
        hasMore && last
          ? encodeWaivSwapsCursor({
              blockTimestamp: new Date(last.block_timestamp),
              id: String(last.id),
            })
          : null,
      hasMore,
    };
  }
}
