import { Module } from '@nestjs/common';
import { ObjectsDomainModule } from '@opden-data-layer/objects-domain';

import { RepositoriesModule } from '../../repositories';
import { FeedModule } from '../feed/feed.module';
import { GovernanceModule } from '../governance';
import { ObjectProjectionModule } from '../object-projection';
import { ObjectUpdatesModule } from '../object-updates/object-updates.module';
import { GetHubActivityFeedEndpoint } from './get-hub-activity-feed.endpoint';
import { GetHubPostsFeedEndpoint } from './get-hub-posts-feed.endpoint';
import { GetHubThreadsFeedEndpoint } from './get-hub-threads-feed.endpoint';
import { GetHubUpdatesFeedEndpoint } from './get-hub-updates-feed.endpoint';

@Module({
  imports: [
    RepositoriesModule,
    ObjectsDomainModule,
    GovernanceModule,
    ObjectProjectionModule,
    FeedModule,
    ObjectUpdatesModule,
  ],
  providers: [
    GetHubPostsFeedEndpoint,
    GetHubThreadsFeedEndpoint,
    GetHubActivityFeedEndpoint,
    GetHubUpdatesFeedEndpoint,
  ],
  exports: [
    GetHubPostsFeedEndpoint,
    GetHubThreadsFeedEndpoint,
    GetHubActivityFeedEndpoint,
    GetHubUpdatesFeedEndpoint,
  ],
})
export class HubFeedModule {}
