import { Injectable } from '@nestjs/common';

import { AccountsCurrentRepository } from '../../repositories';
import { HubFeedFilterItemsHydrator } from './hub-feed-filter-items.hydrator';
import { HubFeedFilterSnapshotService } from './hub-feed-filter-snapshot.service';
import type { HubFeedFilterUsersPageDto } from './hub-feed-filters.dto';
import { resolveFeedFiltersAccount } from './resolve-feed-filters-account';
import type { HubFeedFilterUsersQuery } from './schemas/hub-feed-filters.schema';

/** "Show more" in the rail's followed accounts section (same order as the summary). */
@Injectable()
export class GetUserFeedFilterUsersEndpoint {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly snapshots: HubFeedFilterSnapshotService,
    private readonly hydrator: HubFeedFilterItemsHydrator,
  ) {}

  async execute(name: string, query: HubFeedFilterUsersQuery): Promise<HubFeedFilterUsersPageDto | null> {
    const account = await resolveFeedFiltersAccount(this.accounts, name);
    if (!account) {
      return null;
    }
    const snapshot = await this.snapshots.getSnapshot(account, query.tab);
    const end = query.skip + query.limit;
    return {
      items: await this.hydrator.users(snapshot.users.slice(query.skip, end)),
      hasMore: snapshot.users.length > end,
    };
  }
}
