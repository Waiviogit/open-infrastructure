import { Suspense } from 'react';

import {
  CategoryNav,
  decodeCategoryPathSegment,
  ProfileCategoryNavSkeleton,
} from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string; categoryPath: string[] }>;
};

async function RecipeCategoryLeftSidebarPageContent({ params }: PageProps) {
  const { name, categoryPath } = await params;
  const accountName = decodeURIComponent(name);
  const lineageSegments = categoryPath.map(decodeCategoryPathSegment);
  const basePath = `/@${accountName}/recipe`;

  return (
    <CategoryNav
      accountName={accountName}
      types={['recipe']}
      basePath={basePath}
      sectionKey="recipe"
      lineageSegments={lineageSegments}
    />
  );
}

export default function RecipeCategoryLeftSidebarPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ProfileCategoryNavSkeleton />}>
      <RecipeCategoryLeftSidebarPageContent params={params} />
    </Suspense>
  );
}
