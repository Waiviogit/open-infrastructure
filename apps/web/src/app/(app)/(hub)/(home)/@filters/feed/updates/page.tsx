import { HomeFeedFiltersRail } from '@/modules/home/presentation/components/filters/home-feed-filters-rail';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Rail of the Updates tab (`/feed/updates`). */
export default function HomeFeedUpdatesFilters({ searchParams }: PageProps) {
  return <HomeFeedFiltersRail tab="updates" searchParams={searchParams} />;
}
