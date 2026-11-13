import { z } from 'zod';

const CURSOR_VERSION = 1;

const envelopeSchema = z.object({
  v: z.literal(CURSOR_VERSION),
  f: z.string(),
  p: z.unknown(),
});

/** Time keyset: `(feed time, author, permlink)` (Posts, Threads). */
export const hubTimeCursorSchema = z.object({
  feedAt: z.number().int(),
  author: z.string().min(1),
  permlink: z.string().min(1),
});
export type HubTimeCursor = z.infer<typeof hubTimeCursorSchema>;

/** Score keyset with a pinned window start (ranked Posts, Threads). */
export const hubScoreCursorSchema = z.object({
  score: z.string().regex(/^-?\d+$/),
  author: z.string().min(1),
  permlink: z.string().min(1),
  windowStart: z.number().int(),
});
export type HubScoreCursor = z.infer<typeof hubScoreCursorSchema>;

/** Activity keyset: effective time + event sequence (bigint as string). */
export const hubActivityCursorSchema = z.object({
  createdAtUnix: z.number().int(),
  eventSeq: z.string().regex(/^\d+$/),
});
export type HubActivityCursor = z.infer<typeof hubActivityCursorSchema>;

/** Updates keyset: `(created_at_unix, update_id)`. */
export const hubUpdateTimeCursorSchema = z.object({
  createdAtUnix: z.number().int(),
  updateId: z.string().min(1),
});
export type HubUpdateTimeCursor = z.infer<typeof hubUpdateTimeCursorSchema>;

/** Updates rank keyset with a pinned window start. */
export const hubUpdateRankCursorSchema = hubUpdateTimeCursorSchema.extend({
  score: z.number(),
  windowStart: z.number().int(),
});
export type HubUpdateRankCursor = z.infer<typeof hubUpdateRankCursorSchema>;

export function encodeHubFeedCursor(filterKey: string, payload: unknown): string {
  return Buffer.from(
    JSON.stringify({ v: CURSOR_VERSION, f: filterKey, p: payload }),
    'utf8',
  ).toString('base64url');
}

/**
 * Decodes a cursor issued for `filterKey`. Returns `null` for malformed cursors and for
 * cursors of another filter, so callers answer with an empty page.
 */
export function decodeHubFeedCursor<T>(
  raw: string,
  filterKey: string,
  payloadSchema: z.ZodType<T>,
): T | null {
  try {
    const envelope = envelopeSchema.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    );
    if (!envelope.success || envelope.data.f !== filterKey) {
      return null;
    }
    const payload = payloadSchema.safeParse(envelope.data.p);
    return payload.success ? payload.data : null;
  } catch {
    return null;
  }
}
