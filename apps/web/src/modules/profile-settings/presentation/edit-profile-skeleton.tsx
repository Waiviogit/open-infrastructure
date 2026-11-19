const TEXT_FIELD_ROWS = 5;
const LINK_ROWS = 8;

export function EditProfileSkeleton() {
  return (
    <div className="flex max-w-2xl animate-pulse flex-col gap-6" aria-hidden>
      <div className="h-10 w-48 rounded bg-surface-control" />
      {Array.from({ length: TEXT_FIELD_ROWS }, (_, row) => (
        <div key={row} className="space-y-2">
          <div className="h-4 w-32 rounded bg-surface-control" />
          <div className="h-10 w-full rounded-btn bg-surface-control" />
        </div>
      ))}
      {Array.from({ length: 2 }, (_, row) => (
        <div key={`image-${row}`} className="flex items-center gap-4">
          <div className="size-10 rounded-full bg-surface-control" />
          <div className="h-8 w-32 rounded-btn bg-surface-control" />
        </div>
      ))}
      <div className="space-y-2">
        {Array.from({ length: LINK_ROWS }, (_, row) => (
          <div key={row} className="h-10 w-full rounded-btn bg-surface-control" />
        ))}
      </div>
      <div className="h-10 w-24 rounded-btn bg-surface-control" />
    </div>
  );
}
