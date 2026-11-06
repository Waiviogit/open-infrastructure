import { ProfileExpertiseMainContent } from '@/modules/user-profile/presentation/components/profile-expertise-main-content';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function UserProfileExpertiseHashtagsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return (
    <ProfileExpertiseMainContent
      accountName={decodeURIComponent(name)}
      scope="hashtags"
    />
  );
}
