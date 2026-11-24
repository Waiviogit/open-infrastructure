import { Controller, Get, Query } from '@nestjs/common';

import { ZodQueryPipe } from '../pipes';
import {
  GetHiveDepositCurrenciesEndpoint,
  hiveChangellyDepositCurrenciesQuerySchema,
  type HiveChangellyDepositCurrenciesQuery,
  type HiveChangellyDepositCurrenciesResponse,
} from '../domain/wallet';

/** Account-independent Changelly deposit reference data. */
@Controller({ path: 'wallet/hive/deposit', version: '1' })
export class HiveWalletDepositController {
  constructor(private readonly getCurrencies: GetHiveDepositCurrenciesEndpoint) {}

  @Get('currencies')
  async currencies(
    @Query(new ZodQueryPipe(hiveChangellyDepositCurrenciesQuerySchema))
    query: HiveChangellyDepositCurrenciesQuery,
  ): Promise<HiveChangellyDepositCurrenciesResponse> {
    return this.getCurrencies.execute(query);
  }
}
