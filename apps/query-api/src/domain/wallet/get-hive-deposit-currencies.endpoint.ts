import { Injectable } from '@nestjs/common';

import { HiveChangellyDepositService } from './hive-changelly-deposit.service';
import type {
  HiveChangellyDepositCurrenciesQuery,
  HiveChangellyDepositCurrenciesResponse,
} from './schemas/hive-changelly-deposit.schema';

@Injectable()
export class GetHiveDepositCurrenciesEndpoint {
  constructor(private readonly deposit: HiveChangellyDepositService) {}

  async execute(
    query: HiveChangellyDepositCurrenciesQuery,
  ): Promise<HiveChangellyDepositCurrenciesResponse> {
    return this.deposit.currencies(query);
  }
}
