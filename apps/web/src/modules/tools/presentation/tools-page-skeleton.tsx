const ROW_PLACEHOLDER_COUNT = 4;

/** Tools page content (title + rows) while the page reads the session; route `loading.tsx` only. */
export function ToolsPageSkeleton({ label }: { label: string }) {
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
