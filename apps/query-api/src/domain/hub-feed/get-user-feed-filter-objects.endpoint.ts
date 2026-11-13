import { Injectable } from '@nestjs/common';

import { AccountsCurrentRepository } from '../../repositories';
import {
  HubFeedFilterItemsHydrator,
  type HubFeedFilterHydrationContext,
} from './hub-feed-filter-items.hydrator';
import { HubFeedFilterSnapshotService } from './hub-feed-filter-snapshot.service';
import type { HubFeedFilterObjectsPageDto } from './hub-feed-filters.dto';
import { resolveFeedFiltersAccount } from './resolve-feed-filters-account';
import type { HubFeedFilterObjectsQuery } from './schemas/hub-feed-filters.schema';

/** "Show more" in one object type section of the rail (same order as the summary). */
@Injectable()
export class GetUserFeedFilterObjectsEndpoint {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly snapshots: HubFeedFilterSnapshotService,
    private readonly hydrator: HubFeedFilterItemsHydrator,
  ) {}

  async execute(
    name: string,
    query: HubFeedFilterObjectsQuery,
    ctx: HubFeedFilterHydrationContext,
  ): Promise<HubFeedFilterObjectsPageDto | null> {
    const account = await resolveFeedFiltersAccount(this.accounts, name);
    if (!account) {
      return null;
    }
    const snapshot = await this.snapshots.getSnapshot(account, query.tab);
    const objects =
      snapshot.objectTypes.find((type) => type.objectType === query.object_type)?.objects ?? [];
    const end = query.skip + query.limit;
    const [items] = await this.hydrator.objectGroups(
      [{ objectType: query.object_type, entries: objects.slice(query.skip, end) }],
      ctx,
    );
    return { items: items ?? [], hasMore: objects.length > end };
  }
}
