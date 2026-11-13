import { Module } from '@nestjs/common';
import { ObjectsDomainModule } from '@opden-data-layer/objects-domain';

import { RepositoriesModule } from '../../repositories';
import { FeedModule } from '../feed/feed.module';
import { GovernanceModule } from '../governance';
import { ObjectProjectionModule } from '../object-projection';
import { ObjectUpdatesModule } from '../object-updates/object-updates.module';
import { GetHubActivityFeedEndpoint } from './get-hub-activity-feed.endpoint';
import { GetHubFeedPresenceEndpoint } from './get-hub-feed-presence.endpoint';
import { GetHubPostsFeedEndpoint } from './get-hub-posts-feed.endpoint';
import { GetHubThreadsFeedEndpoint } from './get-hub-threads-feed.endpoint';
import { GetHubUpdatesFeedEndpoint } from './get-hub-updates-feed.endpoint';
import { GetUserFeedFilterObjectsEndpoint } from './get-user-feed-filter-objects.endpoint';
import { GetUserFeedFilterUsersEndpoint } from './get-user-feed-filter-users.endpoint';
import { GetUserFeedFiltersEndpoint } from './get-user-feed-filters.endpoint';
import { HubFeedFilterItemsHydrator } from './hub-feed-filter-items.hydrator';
import { HubFeedFilterSnapshotService } from './hub-feed-filter-snapshot.service';

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
    GetHubFeedPresenceEndpoint,
    HubFeedFilterSnapshotService,
    HubFeedFilterItemsHydrator,
    GetUserFeedFiltersEndpoint,
    GetUserFeedFilterUsersEndpoint,
    GetUserFeedFilterObjectsEndpoint,
  ],
  exports: [
    GetHubPostsFeedEndpoint,
    GetHubThreadsFeedEndpoint,
    GetHubActivityFeedEndpoint,
    GetHubUpdatesFeedEndpoint,
    GetHubFeedPresenceEndpoint,
    GetUserFeedFiltersEndpoint,
    GetUserFeedFilterUsersEndpoint,
    GetUserFeedFilterObjectsEndpoint,
  ],
})
export class HubFeedModule {}
