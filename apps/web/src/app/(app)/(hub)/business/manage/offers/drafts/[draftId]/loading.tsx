import { BusinessPageSkeleton } from '@/modules/business/presentation/ui/business-page-skeleton';

export default function Loading() {
  return (
    <BusinessPageSkeleton variant="entity" scrollKey="business-offer-draft" />
  );
}
