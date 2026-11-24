import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositItem,
  HiveChangellyDepositStatusParams,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class GetUserHiveDepositStatusEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    profileAccountName: string,
    params: HiveChangellyDepositStatusParams,
  ): Promise<HiveChangellyDepositItem | null> {
    return this.deposit.status(profileAccountName, params.exchangeId);
  }
}
