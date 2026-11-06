import { decodeCategoryPathSegment, ProfileShopMainContent } from '@/modules/user-profile';
import { parseProfileShopFilters } from '@/modules/user-profile/domain/profile-shop-filters-url';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string; categoryPath: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UserProfileRecipeCategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { name, categoryPath } = await params;
  const resolvedSearchParams = await searchParams;
  const accountName = decodeURIComponent(name);
  const lineageSegments = categoryPath.map(decodeCategoryPathSegment);
  const basePath = `/@${accountName}/recipe`;
  const shopFilters = parseProfileShopFilters(resolvedSearchParams);

  return (
    <ProfileShopMainContent
      accountName={accountName}
      types={['recipe']}
      basePath={basePath}
      lineageSegments={lineageSegments}
      shopFilters={shopFilters}
      sectionKey="recipe"
    />
  );
}
