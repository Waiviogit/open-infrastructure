import type { MessagingRepository } from '../../repositories';
import type { ObjectActivityMessageRow } from '../../repositories/messaging.repository';
import type { MessageCursorPayload } from './message-feed-cursor';
import { mapMessageToDto, type MessageDto } from './message-projection';

export type FollowedObjectRefDto = {
  object_id: string;
  name: string;
};

export type FollowedObjectsMessageDto = MessageDto & {
  object: FollowedObjectRefDto;
};

export type FollowedObjectsMessagesResponseDto = {
  items: FollowedObjectsMessageDto[];
  cursor: string | null;
  hasMore: boolean;
};

/** Message DTOs for an object-activity page, each with its channel object (id + title). */
export async function buildObjectActivityFeedItems(
  messagingRepo: MessagingRepository,
  page: readonly ObjectActivityMessageRow[],
): Promise<FollowedObjectsMessageDto[]> {
  const channelObjectIds = [
    ...new Set(
      page
        .map((row) => row.channel_object_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameByObjectId = await messagingRepo.findObjectChannelTitles(channelObjectIds);

  return page.map((row) => {
    const objectId = row.channel_object_id?.trim() ?? '';
    const nameFromTitle = nameByObjectId.get(objectId)?.trim();
    return {
      ...mapMessageToDto(row, { duplicateCount: row.duplicate_count }),
      object: {
        object_id: objectId,
        name: nameFromTitle && nameFromTitle.length > 0 ? nameFromTitle : objectId,
      },
    };
  });
}

/** Keyset position after the last row: effective time + event sequence. */
export function nextObjectActivityCursor(
  page: readonly ObjectActivityMessageRow[],
): MessageCursorPayload | null {
  const last = page[page.length - 1];
  if (!last) {
    return null;
  }
  const effectiveUnix = Number(last.original_created_at_unix ?? last.created_at_unix);
  if (!Number.isFinite(effectiveUnix)) {
    return null;
  }
  return { createdAtUnix: effectiveUnix, eventSeq: BigInt(last.event_seq) };
}
