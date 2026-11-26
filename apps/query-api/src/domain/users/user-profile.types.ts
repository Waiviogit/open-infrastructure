export interface UserProfileView {
  name: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  followerCount: number;
  followingCount: number;
  postingCount: number;
  reputation: number;
  /** Waivio user rank (`accounts_current.wobjects_weight`) — lifetime author earnings from posts. */
  wobjectsWeight: number;
  /** True when `X-Viewer` follows this profile (`user_subscriptions`). */
  is_following: boolean;
  /** Bell flag on that subscription; false when not following or bell is null. */
  viewer_bell: boolean;
}

/**
 * `GET /users/:name/head` — the profile without viewer fields, from the indexed account row only
 * (no live Hive metadata).
 */
export type UserHeadView = Omit<UserProfileView, 'is_following' | 'viewer_bell'>;
