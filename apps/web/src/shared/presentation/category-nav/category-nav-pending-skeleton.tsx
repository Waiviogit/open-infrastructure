const CATEGORY_NAV_SKELETON_ROWS = 4;

/** Placeholder rows while a category level loads. */
export function CategoryNavPendingSkeleton() {
  return (
    <ul className="list-none space-y-1 p-0" aria-hidden>
      {Array.from({ length: CATEGORY_NAV_SKELETON_ROWS }, (_, i) => (
        <li key={i}>
          <div className="h-7 w-full animate-pulse rounded-btn bg-surface-control" />
        </li>
      ))}
    </ul>
  );
}
