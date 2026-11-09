import { BusinessManageListSkeleton } from '@/modules/business/presentation/components/skeletons/business-manage-list-skeleton';

/** In the tab segment: the shared `manage/requests` segment does not change on tab switches. */
export default function Loading() {
  return <BusinessManageListSkeleton label="Loading requests" />;
}
