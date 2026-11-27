import { Module } from '@nestjs/common';

import { RepositoriesModule } from '../../repositories';
import { GetWaivStatsEndpoint } from './get-waiv-stats.endpoint';
import { GetWaivSwapsEndpoint } from './get-waiv-swaps.endpoint';
import { WaivJsonCache } from './waiv-json.cache';

@Module({
  imports: [RepositoriesModule],
  providers: [WaivJsonCache, GetWaivStatsEndpoint, GetWaivSwapsEndpoint],
  exports: [GetWaivStatsEndpoint, GetWaivSwapsEndpoint],
})
export class WaivModule {}
