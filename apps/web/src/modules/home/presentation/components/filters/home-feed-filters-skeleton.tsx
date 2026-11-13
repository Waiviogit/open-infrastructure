const SKELETON_ROWS = 8;

/** Rail placeholder while the session and counters stream in. */
export function HomeFeedFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2" aria-hidden>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="h-7 animate-pulse rounded-btn bg-ghost-surface" />
      ))}
    </div>
  );
}
