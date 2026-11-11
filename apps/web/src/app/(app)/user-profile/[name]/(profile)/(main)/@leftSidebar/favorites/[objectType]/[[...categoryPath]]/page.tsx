import { Suspense } from 'react';

import {
  decodeCategoryPathSegment,
  FavoritesRail,
  ProfileFavoritesRailSkeleton,
} from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string; objectType: string; categoryPath?: string[] }>;
};

async function FavoritesByTypeLeftSidebarContent({ params }: PageProps) {
  const { name, objectType, categoryPath = [] } = await params;

  return (
    <FavoritesRail
      accountName={decodeURIComponent(name)}
      routeObjectType={decodeCategoryPathSegment(objectType)}
      lineageSegments={categoryPath.map(decodeCategoryPathSegment)}
    />
  );
}

export default function UserFavoritesByTypeLeftSidebarPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ProfileFavoritesRailSkeleton />}>
      <FavoritesByTypeLeftSidebarContent params={params} />
    </Suspense>
  );
}
