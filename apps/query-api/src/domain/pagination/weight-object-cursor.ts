import { z } from 'zod';

/**
 * Opaque keyset cursor for lists ordered by `weight DESC NULLS LAST, object_id ASC`.
 * Payload is the last row of the previous page, base64url-encoded JSON.
 */
const weightObjectCursorSchema = z.object({
  object_id: z.string().min(1),
  /** Driver/JSON may deliver numeric weight as string — coerce for stable keyset paging. */
  weight: z.union([z.null(), z.coerce.number()]),
});

export type WeightObjectCursorPayload = z.infer<typeof weightObjectCursorSchema>;

export function encodeWeightObjectCursor(payload: WeightObjectCursorPayload): string {
  const weight =
    payload.weight != null && Number.isFinite(Number(payload.weight))
      ? Number(payload.weight)
      : null;
  return Buffer.from(
    JSON.stringify({ weight, object_id: payload.object_id }),
    'utf8',
  ).toString('base64url');
}

export function decodeWeightObjectCursor(raw: string): WeightObjectCursorPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const json = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    const result = weightObjectCursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** True when `raw` is absent or decodes to a valid cursor (Zod refine helper). */
export function isValidWeightObjectCursor(raw: string | undefined): boolean {
  if (raw == null) {
    return true;
  }
  return decodeWeightObjectCursor(raw) != null;
}
