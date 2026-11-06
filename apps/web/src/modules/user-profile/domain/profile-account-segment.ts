/**
 * URL shape accepted for `/@account` and `/user-profile/[name]`. Looser than the Hive grammar
 * (mixed case, up to 32 chars) on purpose: it only rejects garbage URLs; whether the account
 * exists is decided by query-api.
 */
const PROFILE_ACCOUNT_SEGMENT_RE = /^[a-zA-Z0-9.-]{3,32}$/;

/** `segment` is the raw (possibly percent-encoded) path segment. */
export function isProfileAccountSegment(segment: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return false;
  }
  return PROFILE_ACCOUNT_SEGMENT_RE.test(decoded);
}
