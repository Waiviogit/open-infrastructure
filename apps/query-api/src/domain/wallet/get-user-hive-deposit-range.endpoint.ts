import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositRangeQuery,
  HiveChangellyDepositRangeResponse,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class GetUserHiveDepositRangeEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    profileAccountName: string,
    query: HiveChangellyDepositRangeQuery,
  ): Promise<HiveChangellyDepositRangeResponse | null> {
    return this.deposit.range(profileAccountName, query);
  }
}
