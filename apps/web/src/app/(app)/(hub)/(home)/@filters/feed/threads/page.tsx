import { HomeFeedFiltersRail } from '@/modules/home/presentation/components/filters/home-feed-filters-rail';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Rail of the Threads tab (`/feed/threads`). */
export default function HomeFeedThreadsFilters({ searchParams }: PageProps) {
  return <HomeFeedFiltersRail tab="threads" searchParams={searchParams} />;
}
