import { Module } from '@nestjs/common';
import { ObjectsDomainModule } from '@opden-data-layer/objects-domain';
import { GovernanceModule } from '../governance';
import { ObjectProjectionModule } from '../object-projection';
import { RepositoriesModule } from '../../repositories';
import { GetFollowedObjectsUpdatesFeedEndpoint } from './get-followed-objects-updates-feed.endpoint';
import { GetObjectUpdatesFeedEndpoint } from './get-object-updates-feed.endpoint';
import { GetUpdateVotersEndpoint } from './get-update-voters.endpoint';
import { ObjectUpdateFeedItemsBuilder } from './object-update-feed-items.builder';

@Module({
  imports: [RepositoriesModule, GovernanceModule, ObjectsDomainModule, ObjectProjectionModule],
  providers: [
    ObjectUpdateFeedItemsBuilder,
    GetObjectUpdatesFeedEndpoint,
    GetFollowedObjectsUpdatesFeedEndpoint,
    GetUpdateVotersEndpoint,
  ],
  exports: [
    ObjectUpdateFeedItemsBuilder,
    GetObjectUpdatesFeedEndpoint,
    GetFollowedObjectsUpdatesFeedEndpoint,
    GetUpdateVotersEndpoint,
  ],
})
export class ObjectUpdatesModule {}
