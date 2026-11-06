import { Suspense } from 'react';

import {
  FavoritesTypeNav,
  getFavoritesTypesQuery,
  ProfileFavoritesTypeNavSkeleton,
} from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string; objectType: string }>;
};

async function FavoritesByTypeLeftSidebarContent({ params }: PageProps) {
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

export default function UserFavoritesByTypeLeftSidebarPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ProfileFavoritesTypeNavSkeleton />}>
      <FavoritesByTypeLeftSidebarContent params={params} />
    </Suspense>
  );
}
