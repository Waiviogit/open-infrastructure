import { Suspense } from 'react';

import { FavoritesRail, ProfileFavoritesRailSkeleton } from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string }>;
};

async function FavoritesLeftSidebarContent({ params }: PageProps) {
  const { name } = await params;
  return <FavoritesRail accountName={decodeURIComponent(name)} />;
}

export default function UserFavoritesLeftSidebarPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ProfileFavoritesRailSkeleton />}>
      <FavoritesLeftSidebarContent params={params} />
    </Suspense>
  );
}
