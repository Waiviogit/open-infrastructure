import { AppHeader } from '@/modules/app-header';
import { getUserProfileQuery } from '@/modules/user-profile';
import { getUserFeedUnreadCountsQuery } from '@/modules/user-profile/application/queries/get-user-feed-unread-counts.query';
import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';

/** Header avatar shares the profile hero's cached query-api entry, refreshed after a profile save. */
async function loadViewerAvatarUrl(username: string): Promise<string | null> {
  try {
    const profile = await getUserProfileQuery(username);
    return profile?.avatarUrl ?? null;
  } catch {
    return null;
  }
}

export async function AppHeaderUser() {
  const current = await getRequestUser();
  if (!current) {
    return <AppHeader user={null} messagesUnreadCount={0} />;
  }
  const [unreadCounts, avatarUrl] = await Promise.all([
    getUserFeedUnreadCountsQuery(current.username, current.username),
    loadViewerAvatarUrl(current.username),
  ]);
  return (
    <AppHeader
      user={{ username: current.username, avatarUrl }}
      messagesUnreadCount={unreadCounts?.messages ?? 0}
    />
  );
}
