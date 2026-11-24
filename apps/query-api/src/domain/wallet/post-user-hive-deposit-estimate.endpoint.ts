import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositEstimateBody,
  HiveChangellyDepositEstimateResponse,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class PostUserHiveDepositEstimateEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    profileAccountName: string,
    body: HiveChangellyDepositEstimateBody,
  ): Promise<HiveChangellyDepositEstimateResponse | null> {
    return this.deposit.estimate(profileAccountName, body);
  }
}
