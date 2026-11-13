import { HomeFeedFiltersRail } from '@/modules/home/presentation/components/filters/home-feed-filters-rail';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Rail of the Posts tab (`/`). */
export default function HomeFeedPostsFilters({ searchParams }: PageProps) {
  return <HomeFeedFiltersRail tab="posts" searchParams={searchParams} />;
}
