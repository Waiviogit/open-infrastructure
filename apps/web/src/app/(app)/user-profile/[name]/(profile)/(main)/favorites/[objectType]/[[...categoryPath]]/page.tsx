import { decodeCategoryPathSegment, ProfileFavoritesMainContent } from '@/modules/user-profile';
import { readFavoritesOtherParam } from '@/modules/user-profile/domain/favorites-path';
import { parseProfileShopFilters } from '@/modules/user-profile/domain/profile-shop-filters-url';

type PageProps = {
  params: Promise<{ name: string; objectType: string; categoryPath?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `/@:name/favorites/:objectType[/...categoryPath]` — one type, optional category lineage. */
export default async function UserProfileFavoritesByTypePage({ params, searchParams }: PageProps) {
  const [{ name, objectType, categoryPath = [] }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <ProfileFavoritesMainContent
      accountName={decodeURIComponent(name)}
      routeObjectType={decodeCategoryPathSegment(objectType)}
      lineageSegments={categoryPath.map(decodeCategoryPathSegment)}
      categoryOther={readFavoritesOtherParam(resolvedSearchParams)}
      shopFilters={parseProfileShopFilters(resolvedSearchParams)}
    />
  );
}
