export type AppHeaderUser = {
  readonly username: string;
  /** Query-api avatar (same source as the profile hero); `null` falls back to the Hive CDN in `UserAvatar`. */
  readonly avatarUrl?: string | null;
};
