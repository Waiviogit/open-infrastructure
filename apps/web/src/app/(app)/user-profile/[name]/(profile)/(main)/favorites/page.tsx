import { ProfileFavoritesMainContent } from '@/modules/user-profile';
import { readFavoritesOtherParam } from '@/modules/user-profile/domain/favorites-path';
import { parseProfileShopFilters } from '@/modules/user-profile/domain/profile-shop-filters-url';

type PageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Bare `/@:name/favorites` — shows the user's first Favorites type. */
export default async function UserProfileFavoritesPage({ params, searchParams }: PageProps) {
  const [{ name }, resolvedSearchParams] = await Promise.all([params, searchParams]);

  return (
    <ProfileFavoritesMainContent
      accountName={decodeURIComponent(name)}
      categoryOther={readFavoritesOtherParam(resolvedSearchParams)}
      shopFilters={parseProfileShopFilters(resolvedSearchParams)}
    />
  );
}
