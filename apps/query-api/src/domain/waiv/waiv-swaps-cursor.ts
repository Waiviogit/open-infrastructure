import { z } from 'zod';

import type { HiveEngineSwapKeyset } from '../../repositories';

const cursorPayloadSchema = z.object({
  t: z.iso.datetime(),
  id: z.string().regex(/^\d{1,19}$/),
});

/** Opaque base64url cursor over `(block_timestamp, id)` of the last row on a page. */
export function encodeWaivSwapsCursor(keyset: HiveEngineSwapKeyset): string {
  const payload = { t: keyset.blockTimestamp.toISOString(), id: keyset.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** `null` for anything that is not a cursor this API issued. */
export function decodeWaivSwapsCursor(raw: string): HiveEngineSwapKeyset | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const result = cursorPayloadSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    return { blockTimestamp: new Date(result.data.t), id: result.data.id };
  } catch {
    return null;
  }
}
