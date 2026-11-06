import { parseActivityFilters } from '@/modules/user-activity/domain/activity-filters-url';

import { FeedProfileContent } from '../../../feed-profile-content';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function UserProfileActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);
  const activityFilters = parseActivityFilters(await searchParams);
  return (
    <FeedProfileContent
      accountName={accountName}
      feedTab="activity"
      activityFilters={activityFilters}
    />
  );
}
