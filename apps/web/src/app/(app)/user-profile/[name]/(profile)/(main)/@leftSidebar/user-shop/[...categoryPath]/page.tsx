import { Suspense } from 'react';

import {
  CategoryNav,
  decodeCategoryPathSegment,
  ProfileCategoryNavSkeleton,
} from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string; categoryPath: string[] }>;
};

async function UserShopCategoryLeftSidebarPageContent({ params }: PageProps) {
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

export default function UserShopCategoryLeftSidebarPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ProfileCategoryNavSkeleton />}>
      <UserShopCategoryLeftSidebarPageContent params={params} />
    </Suspense>
  );
}
