import { ProfileFavoritesMainContent } from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string; objectType: string }>;
};

export default async function UserProfileFavoritesByTypePage({ params }: PageProps) {
  const { name, objectType } = await params;
  const accountName = decodeURIComponent(name);

  return (
    <ProfileFavoritesMainContent
      accountName={accountName}
      routeObjectType={decodeURIComponent(objectType)}
    />
  );
}
