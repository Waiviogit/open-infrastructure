import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositCreateBody,
  HiveChangellyDepositCreateResponse,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class PostUserHiveDepositCreateEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    profileAccountName: string,
    body: HiveChangellyDepositCreateBody,
  ): Promise<HiveChangellyDepositCreateResponse | null> {
    return this.deposit.create(profileAccountName, body);
  }
}
