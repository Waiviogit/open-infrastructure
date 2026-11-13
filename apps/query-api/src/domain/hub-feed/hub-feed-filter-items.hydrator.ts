import { Injectable } from '@nestjs/common';
import { ObjectViewService } from '@opden-data-layer/objects-domain';

import { AccountsCurrentRepository, AggregatedObjectRepository } from '../../repositories';
import { projectFeedObjectsById } from '../feed/project-feed-objects';
import { GovernanceResolverService } from '../governance';
import { ObjectProjectionService } from '../object-projection';
import { loadAccountAvatarUrls } from '../users/load-account-avatar-urls';
import type { HubFeedFilterObjectDto, HubFeedFilterUserDto } from './hub-feed-filters.dto';
import type { HubFeedFilterObjectEntry, HubFeedFilterUserEntry } from './hub-feed-filter-snapshot';

export interface HubFeedFilterHydrationContext {
  locale: string;
  governanceObjectIdFromHeader: string | undefined;
  viewerAccount: string | undefined;
}

/** Adds avatars to rail accounts and a light projection to rail objects (one batch each). */
@Injectable()
export class HubFeedFilterItemsHydrator {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly aggregatedObjectRepo: AggregatedObjectRepository,
    private readonly objectViewService: ObjectViewService,
    private readonly objectProjection: ObjectProjectionService,
    private readonly governanceResolver: GovernanceResolverService,
  ) {}

  async users(entries: readonly HubFeedFilterUserEntry[]): Promise<HubFeedFilterUserDto[]> {
    const avatars = await loadAccountAvatarUrls(
      this.accounts,
      entries.map((entry) => entry.name),
    );
    return entries.map((entry) => ({
      name: entry.name,
      avatarUrl: avatars.get(entry.name) ?? null,
      count: entry.count,
    }));
  }

  /** `groups` keeps each object's type; all objects are projected in one batch. */
  async objectGroups(
    groups: readonly { objectType: string; entries: readonly HubFeedFilterObjectEntry[] }[],
    ctx: HubFeedFilterHydrationContext,
  ): Promise<HubFeedFilterObjectDto[][]> {
    const ids = groups.flatMap((group) => group.entries.map((entry) => entry.objectId));
    if (ids.length === 0) {
      return groups.map(() => []);
    }
    const governance = await this.governanceResolver.resolveMergedForObjectView(
      ctx.governanceObjectIdFromHeader,
    );
    const projected = await projectFeedObjectsById(
      {
        aggregatedObjectRepo: this.aggregatedObjectRepo,
        objectViewService: this.objectViewService,
        objectProjection: this.objectProjection,
      },
      ids,
      {
        locale: ctx.locale,
        governance,
        governanceObjectIdFromHeader: ctx.governanceObjectIdFromHeader,
        viewerAccount: ctx.viewerAccount,
      },
    );
    return groups.map((group) =>
      group.entries.map((entry) => ({
        objectId: entry.objectId,
        objectType: group.objectType,
        count: entry.count,
        object: projected.get(entry.objectId) ?? null,
      })),
    );
  }
}
