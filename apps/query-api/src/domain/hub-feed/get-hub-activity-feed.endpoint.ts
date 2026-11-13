import { Injectable } from '@nestjs/common';

import {
  HubActivityFeedRepository,
  MessagingRepository,
  UserAccountMutesRepository,
} from '../../repositories';
import {
  normalizeActivityRow,
  type ObjectActivityMessageRow,
} from '../../repositories/messaging.repository';
import { GovernanceResolverService } from '../governance';
import {
  buildObjectActivityFeedItems,
  nextObjectActivityCursor,
  type FollowedObjectsMessagesResponseDto,
} from '../messaging/build-object-activity-feed-items';
import type { MessageCursorPayload } from '../messaging/message-feed-cursor';
import { resolveActivityExcludedAuthors } from '../messaging/resolve-activity-excluded-authors';
import { decodeHubFeedCursor, encodeHubFeedCursor, hubActivityCursorSchema } from './hub-feed-cursor';
import { assertNeverHubFeedFilter, hubFeedFilterKey } from './hub-feed-filter';
import { HubFeedViewerRequiredError } from './hub-feed-viewer-required.error';
import type { HubActivityFeedBody } from './schemas/hub-feed.schema';

const EMPTY_PAGE: FollowedObjectsMessagesResponseDto = { items: [], cursor: null, hasMore: false };

/**
 * Hub "Activity" tab for one rail filter: canonical object-channel messages,
 * newest first by effective time. Governance and viewer mutes apply to every filter
 * except `author`.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class GetHubActivityFeedEndpoint {
  constructor(
    private readonly hubActivityRepo: HubActivityFeedRepository,
    private readonly messagingRepo: MessagingRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
  ) {}

  async execute(
    body: HubActivityFeedBody,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<FollowedObjectsMessagesResponseDto> {
    const viewer = viewerAccount?.trim() ?? '';
    const filter = body.filter;
    if (filter.kind === 'my' && viewer.length === 0) {
      throw new HubFeedViewerRequiredError();
    }

    const key = hubFeedFilterKey(filter);
    const decoded = body.cursor ? decodeHubFeedCursor(body.cursor, key, hubActivityCursorSchema) : null;
    if (body.cursor && !decoded) {
      return EMPTY_PAGE;
    }
    const cursor: MessageCursorPayload | null = decoded
      ? { createdAtUnix: decoded.createdAtUnix, eventSeq: BigInt(decoded.eventSeq) }
      : null;

    const rows = await this.loadRows(body, viewer, governanceObjectIdFromHeader, cursor);
    const hasMore = rows.length > body.limit;
    const page = hasMore ? rows.slice(0, body.limit) : rows;
    if (page.length === 0) {
      return EMPTY_PAGE;
    }

    const items = await buildObjectActivityFeedItems(this.messagingRepo, page);
    const next = hasMore ? nextObjectActivityCursor(page) : null;
    return {
      items,
      cursor: next
        ? encodeHubFeedCursor(key, { createdAtUnix: next.createdAtUnix, eventSeq: next.eventSeq.toString() })
        : null,
      hasMore: next !== null,
    };
  }

  private async loadRows(
    body: HubActivityFeedBody,
    viewer: string,
    governanceObjectIdFromHeader: string | undefined,
    cursor: MessageCursorPayload | null,
  ): Promise<ObjectActivityMessageRow[]> {
    const filter = body.filter;
    const limitPlusOne = body.limit + 1;
    if (filter.kind === 'author') {
      return this.hubActivityRepo.findByAuthor(filter.account, cursor, limitPlusOne);
    }

    const excluded = await resolveActivityExcludedAuthors(
      this.governanceResolver,
      this.userAccountMutesRepo,
      governanceObjectIdFromHeader,
      viewer,
    );
    switch (filter.kind) {
      case 'new':
        return this.hubActivityRepo.findNew(excluded, cursor, limitPlusOne);
      case 'my':
        return this.hubActivityRepo.findMy(viewer, excluded, cursor, limitPlusOne);
      case 'object': {
        // This shared query returns driver values (bigint columns as strings); the hub
        // queries already normalize theirs.
        const rows = await this.messagingRepo.listObjectActivityMessages(
          filter.object_id,
          excluded,
          cursor,
          limitPlusOne,
        );
        return rows.map(normalizeActivityRow);
      }
      default:
        return assertNeverHubFeedFilter(filter);
    }
  }
}
