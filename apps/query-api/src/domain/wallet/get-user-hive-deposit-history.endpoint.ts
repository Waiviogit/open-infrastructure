import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositHistoryQuery,
  HiveChangellyDepositHistoryResponse,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class GetUserHiveDepositHistoryEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    profileAccountName: string,
    query: HiveChangellyDepositHistoryQuery,
  ): Promise<HiveChangellyDepositHistoryResponse | null> {
    return this.deposit.history(profileAccountName, query);
  }
}
