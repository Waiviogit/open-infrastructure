import { CategoryNav, decodeCategoryPathSegment } from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string; categoryPath: string[] }>;
};

export default async function UserShopCategoryLeftSidebarPage({ params }: PageProps) {
  const { name, categoryPath } = await params;
  const accountName = decodeURIComponent(name);
  const lineageSegments = categoryPath.map(decodeCategoryPathSegment);
  const basePath = `/@${accountName}/user-shop`;

  return (
    <CategoryNav
      accountName={accountName}
      types={['book', 'product']}
      basePath={basePath}
      sectionKey="user-shop"
      lineageSegments={lineageSegments}
    />
  );
}
