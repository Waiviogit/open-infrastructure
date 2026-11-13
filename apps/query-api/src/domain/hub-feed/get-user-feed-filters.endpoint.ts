import { Injectable } from '@nestjs/common';

import { AccountsCurrentRepository } from '../../repositories';
import { HubFeedFilterItemsHydrator, type HubFeedFilterHydrationContext } from './hub-feed-filter-items.hydrator';
import { HubFeedFilterSnapshotService } from './hub-feed-filter-snapshot.service';
import type { HubFeedFiltersDto } from './hub-feed-filters.dto';
import { HUB_FEED_COUNTER_WINDOW_HOURS } from './hub-feed.constants';
import { resolveFeedFiltersAccount } from './resolve-feed-filters-account';
import type { HubFeedFiltersQuery } from './schemas/hub-feed-filters.schema';

/**
 * Hub rail for one account and tab: followed accounts and followed objects grouped by type,
 * each with new items in the last 3 days: the first rows of every section. "Show more" is
 * served by `GetUserFeedFilterUsersEndpoint` / `GetUserFeedFilterObjectsEndpoint`.
 * Returns `null` when the account does not exist.
 * @see docs/apps/query-api/spec/hub-feed-filters.md
 */
@Injectable()
export class GetUserFeedFiltersEndpoint {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly snapshots: HubFeedFilterSnapshotService,
    private readonly hydrator: HubFeedFilterItemsHydrator,
  ) {}

  async execute(
    name: string,
    query: HubFeedFiltersQuery,
    ctx: HubFeedFilterHydrationContext,
  ): Promise<HubFeedFiltersDto | null> {
    const account = await resolveFeedFiltersAccount(this.accounts, name);
    if (!account) {
      return null;
    }
    const snapshot = await this.snapshots.getSnapshot(account, query.tab);

    const userEntries = snapshot.users.slice(0, query.users_limit);
    const groups = snapshot.objectTypes.map((type) => ({
      objectType: type.objectType,
      entries: type.objects.slice(0, query.objects_limit),
    }));
    const [users, objectsByGroup] = await Promise.all([
      this.hydrator.users(userEntries),
      this.hydrator.objectGroups(groups, ctx),
    ]);

    return {
      tab: query.tab,
      windowHours: HUB_FEED_COUNTER_WINDOW_HOURS,
      windowStart: snapshot.windowStart,
      countsAvailable: snapshot.countsAvailable,
      users: {
        items: users,
        total: snapshot.users.length,
        hasMore: snapshot.users.length > userEntries.length,
      },
      objectTypes: snapshot.objectTypes.map((type, index) => ({
        objectType: type.objectType,
        count: type.count,
        total: type.objects.length,
        objects: {
          items: objectsByGroup[index] ?? [],
          hasMore: type.objects.length > groups[index].entries.length,
        },
      })),
    };
  }
}
