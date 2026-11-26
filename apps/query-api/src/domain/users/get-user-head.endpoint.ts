import { Injectable } from '@nestjs/common';

import { AccountsCurrentRepository } from '../../repositories';
import { mapAccountToUserProfileView } from './account-mapper';
import type { UserHeadView } from './user-profile.types';

/**
 * Viewer-independent head of a profile page: what the hero paints before the full profile.
 * One `accounts_current` primary-key read mapped by the same {@link mapAccountToUserProfileView}
 * as `GET /users/:name/profile`, without the live Hive metadata call or viewer lookups.
 * @see docs/apps/query-api/spec/user-head.md
 */
@Injectable()
export class GetUserHeadEndpoint {
  constructor(private readonly accounts: AccountsCurrentRepository) {}

  async execute(accountName: string): Promise<UserHeadView | null> {
    const row = await this.accounts.findByName(accountName);
    if (!row) {
      return null;
    }
    const view = mapAccountToUserProfileView(row, null);
    return {
      name: view.name,
      displayName: view.displayName,
      bio: view.bio,
      avatarUrl: view.avatarUrl,
      coverImageUrl: view.coverImageUrl,
      followerCount: view.followerCount,
      followingCount: view.followingCount,
      postingCount: view.postingCount,
      reputation: view.reputation,
      wobjectsWeight: view.wobjectsWeight,
    };
  }
}
