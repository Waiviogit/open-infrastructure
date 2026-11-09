const ROW_PLACEHOLDER_COUNT = 4;

/** Page title + list rows; route `loading.tsx` for list pages that read the session first. */
export function TitledListSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="mb-8 h-10 w-64 animate-pulse rounded bg-surface-control" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: ROW_PLACEHOLDER_COUNT }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-card bg-surface-control" />
        ))}
      </div>
    </div>
  );
}
