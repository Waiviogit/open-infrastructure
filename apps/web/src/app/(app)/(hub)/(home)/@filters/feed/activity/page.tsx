import { HomeFeedFiltersRail } from '@/modules/home/presentation/components/filters/home-feed-filters-rail';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Rail of the Activity tab (`/feed/activity`). */
export default function HomeFeedActivityFilters({ searchParams }: PageProps) {
  return <HomeFeedFiltersRail tab="activity" searchParams={searchParams} />;
}
