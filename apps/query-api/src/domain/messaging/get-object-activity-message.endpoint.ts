import { Injectable } from '@nestjs/common';
import {
  MessagingRepository,
  ObjectsCoreRepository,
  UserAccountMutesRepository,
} from '../../repositories';
import { GovernanceResolverService } from '../governance';
import { mapMessageToDto, type MessageDto } from './message-projection';
import { resolveActivityExcludedAuthors } from './resolve-activity-excluded-authors';

export type GetObjectActivityMessageParams = {
  objectId: string;
  messageId: string;
  governanceObjectIdFromHeader?: string;
  viewerAccount?: string;
};

/**
 * Single object activity message (permalink `/object/:id/social/activity/:messageId`).
 * Visible when the message lives in the object's channel or links the object, and its author
 * is not muted by governance or the viewer — the same rules as the activity list.
 */
@Injectable()
export class GetObjectActivityMessageEndpoint {
  constructor(
    private readonly objectsCoreRepo: ObjectsCoreRepository,
    private readonly messagingRepo: MessagingRepository,
    private readonly governanceResolver: GovernanceResolverService,
    private readonly userAccountMutesRepo: UserAccountMutesRepository,
  ) {}

  async execute(params: GetObjectActivityMessageParams): Promise<MessageDto | null> {
    const objectId = params.objectId.trim();
    const messageId = params.messageId.trim();
    if (!objectId || !messageId) {
      return null;
    }

    const core = await this.objectsCoreRepo.findByObjectIdForPage(objectId);
    if (!core) {
      return null;
    }

    const excludedAuthors = await resolveActivityExcludedAuthors(
      this.governanceResolver,
      this.userAccountMutesRepo,
      params.governanceObjectIdFromHeader,
      params.viewerAccount,
    );

    const row = await this.messagingRepo.findObjectActivityMessage(
      objectId,
      messageId,
      excludedAuthors,
    );
    if (!row) {
      return null;
    }

    const channelObjectId = row.channel_object_id?.trim() ?? null;
    const sourceNameByObjectId = await this.messagingRepo.findObjectChannelTitles(
      channelObjectId && channelObjectId !== objectId ? [channelObjectId] : [],
    );

    return mapMessageToDto(row, {
      requestedObjectId: objectId,
      channelObjectId,
      sourceNameByObjectId,
      duplicateCount: row.duplicate_count,
    });
  }
}
