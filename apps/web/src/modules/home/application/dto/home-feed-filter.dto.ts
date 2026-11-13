import { isHiveAccountName } from '@opden-data-layer/common';
import { z } from 'zod';

import type { HomeFeedFilter } from '../../domain/home-feed-filter';

const OBJECT_ID_MAX_LENGTH = 256;

/** Filter as passed from client lists to server actions (untrusted: validated on the server). */
export const homeFeedFilterSchema: z.ZodType<HomeFeedFilter> = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['trending', 'hot', 'new']) }),
  z.object({ kind: z.literal('my') }),
  z.object({ kind: z.literal('author'), account: z.string().refine(isHiveAccountName) }),
  z.object({ kind: z.literal('object'), objectId: z.string().min(1).max(OBJECT_ID_MAX_LENGTH) }),
]) as z.ZodType<HomeFeedFilter>;

/** query-api `filter` body field of `POST /query/v1/feed/{tab}`. */
export type HubFeedApiFilter =
  | { kind: 'trending' | 'hot' | 'new' | 'my' }
  | { kind: 'author'; account: string }
  | { kind: 'object'; object_id: string };

export function toHubFeedApiFilter(filter: HomeFeedFilter): HubFeedApiFilter {
  switch (filter.kind) {
    case 'author':
      return { kind: 'author', account: filter.account };
    case 'object':
      return { kind: 'object', object_id: filter.objectId };
    default:
      return { kind: filter.kind };
  }
}
