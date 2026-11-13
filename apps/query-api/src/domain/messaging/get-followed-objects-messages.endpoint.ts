import { Injectable } from '@nestjs/common';
import {
  AccountsCurrentRepository,
  MessagingRepository,
  UserAccountMutesRepository,
} from '../../repositories';
import { GovernanceResolverService } from '../governance';
import type { ObjectActivityMessageHistoryBody } from './schemas/messaging.schema';
import { resolveActivityAuthorsAllowlist } from '../governance/resolve-activity-authors-allowlist';
import {
  decodeMessageCursor,
  encodeMessageCursor,
} from './message-feed-cursor';
import {
  buildObjectActivityFeedItems,
  nextObjectActivityCursor,
  type FollowedObjectsMessagesResponseDto,
} from './build-object-activity-feed-items';
import { resolveActivityExcludedAuthors } from './resolve-activity-excluded-authors';

export type {
  FollowedObjectRefDto,
  FollowedObjectsMessageDto,
  FollowedObjectsMessagesResponseDto,
} from './build-object-activity-feed-items';

@Injectable()
export class GetFollowedObjectsMessagesEndpoint {
  constructor(
    private readonly accounts: AccountsCurrentRepository,
    private readonly messagingRepo: MessagingRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
  ) {}

  async execute(
    username: string,
    body: ObjectActivityMessageHistoryBody,
    governanceObjectIdFromHeader?: string,
    viewerAccount?: string,
  ): Promise<FollowedObjectsMessagesResponseDto | null> {
    const name = username.trim();
    if (name.length === 0) {
      return null;
    }

    const account = await this.accounts.findByName(name);
    if (!account) {
      return null;
    }

    const viewerTrimmed = viewerAccount?.trim() ?? '';
    const excludedAuthors = await resolveActivityExcludedAuthors(
      this.governanceResolver,
      this.userAccountMutesRepo,
      governanceObjectIdFromHeader,
      viewerTrimmed,
    );
    const includeDuplicates = body.for_context
      ? false
      : (body.include_duplicates ?? false);
    const forContextViewer =
      body.for_context && viewerTrimmed.length > 0 ? viewerTrimmed : undefined;

    const includedAuthors = await resolveActivityAuthorsAllowlist(this.governanceResolver, {
      authorsOnly: body.authors_only,
      governanceObjectIdFromHeader,
      authorsGovernanceObjectId: body.authors_governance_object_id,
    });
    if (includedAuthors && includedAuthors.length === 0) {
      return { items: [], cursor: null, hasMore: false };
    }

    const limit = body.limit;
    const cursorPayload = body.cursor ? decodeMessageCursor(body.cursor) : null;
    if (body.cursor && !cursorPayload) {
      return { items: [], cursor: null, hasMore: false };
    }

    const rows = await this.messagingRepo.listFollowedObjectActivityMessages(
      name,
      excludedAuthors,
      cursorPayload,
      limit + 1,
      forContextViewer,
      includeDuplicates,
      includedAuthors,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await buildObjectActivityFeedItems(this.messagingRepo, page);
    const nextPosition = hasMore ? nextObjectActivityCursor(page) : null;
    const nextCursor = nextPosition ? encodeMessageCursor(nextPosition) : null;

    return {
      items,
      cursor: nextCursor,
      hasMore: hasMore && nextCursor != null,
    };
  }
}
