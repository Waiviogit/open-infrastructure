import { getFavoritesTypesQuery, FavoritesTypeNav } from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string; objectType: string }>;
};

export default async function UserFavoritesByTypeLeftSidebarPage({ params }: PageProps) {
  const { name, objectType } = await params;
  const accountName = decodeURIComponent(name);
  const decodedType = decodeURIComponent(objectType);
  const { types } = await getFavoritesTypesQuery(accountName);

  return (
    <FavoritesTypeNav
      accountName={accountName}
      types={types}
      activeType={decodedType}
    />
  );
}
