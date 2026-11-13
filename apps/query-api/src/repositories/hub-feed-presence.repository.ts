import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { FeedActivityBucketEntityKind, FeedActivityBucketTab } from '@opden-data-layer/odl-db-types';

import type { Database } from '../database';
import { KYSELY } from '../database';

/**
 * Hub tabs on which an account / object has any item (`feed_activity_presence`, kept by
 * the scheduler). At most four primary-key rows.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class HubFeedPresenceRepository {
  private readonly logger = new Logger(HubFeedPresenceRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  async findTabs(
    entityKind: FeedActivityBucketEntityKind,
    entityId: string,
  ): Promise<FeedActivityBucketTab[] | null> {
    try {
      const rows = await this.db
        .selectFrom('feed_activity_presence')
        .select('tab')
        .where('entity_kind', '=', entityKind)
        .where('entity_id', '=', entityId)
        .execute();
      return rows.map((row) => row.tab);
    } catch (error) {
      this.logger.error((error as Error).message);
      return null;
    }
  }
}
