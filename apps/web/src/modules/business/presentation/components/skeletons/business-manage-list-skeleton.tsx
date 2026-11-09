import { BusinessListSkeleton } from './business-list-skeleton';

const TAB_PLACEHOLDER_COUNT = 3;

/** Manage list tabs (drafts / published / retired): title, tab pills, list rows. */
export function BusinessManageListSkeleton({ label }: { label: string }) {
  return (
    <div className="p-page-padding" aria-busy="true" aria-label={label}>
      <div className="mb-6 h-8 w-40 animate-pulse rounded bg-surface-alt" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: TAB_PLACEHOLDER_COUNT }, (_, index) => (
          <div key={index} className="h-8 w-24 animate-pulse rounded-pill bg-surface-alt" />
        ))}
      </div>
      <BusinessListSkeleton />
    </div>
  );
}
