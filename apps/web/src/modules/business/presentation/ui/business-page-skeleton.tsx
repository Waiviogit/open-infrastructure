import { ScrollToTopOnEnter } from '@/shared/presentation';

import { businessCardClass } from './classes';

const ROW_COUNT = 4;
const RAIL_ROW_COUNT = 3;
const BAR = 'animate-pulse rounded-btn bg-surface-control';

/** Matches `BUSINESS_SHELL_GRID_CLASS` in the page shell (kept literal: this file is server-safe). */
const GRID_CLASS = [
  'mt-card-padding grid grid-cols-1 gap-card-padding pb-section-y',
  'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
].join(' ');

export type BusinessPageSkeletonProps = {
  /** List pages have a context rail and cards; entity pages a wide header and sections. */
  variant?: 'list' | 'entity';
  withRail?: boolean;
  /** Entry frames of pages opened from a scrolled list reset the scroll before paint. */
  scrollKey?: string;
};

/**
 * Loading frame for every Market route: the same grid as `BusinessPageShell`, so the rail, the
 * heading and the cards keep their place when the data arrives. The hub band stays mounted.
 */
export function BusinessPageSkeleton({
  variant = 'list',
  withRail = variant === 'list',
  scrollKey,
}: BusinessPageSkeletonProps) {
  const isEntity = variant === 'entity';
  /** Mirrors the shell: an entity page without a rail spans the whole grid. */
  const fullWidth = isEntity && !withRail;
  const contentSpan = fullWidth
    ? 'lg:col-span-3'
    : isEntity
      ? 'lg:col-span-2'
      : '';

  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label="Loading business">
      {scrollKey ? <ScrollToTopOnEnter routeKey={scrollKey} /> : null}
      {fullWidth ? null : (
        <div className="hidden min-w-0 lg:block" aria-hidden>
          {withRail ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: RAIL_ROW_COUNT }, (_, i) => (
                <div key={i} className={`h-8 ${BAR}`} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      <div
        className={`flex min-w-0 flex-col gap-card-padding ${contentSpan}`}
        aria-hidden
      >
        <div className="flex flex-col gap-2">
          {isEntity ? <div className={`h-4 w-32 ${BAR}`} /> : null}
          <div className={`${isEntity ? 'h-8 w-2/3' : 'h-6 w-40'} ${BAR}`} />
          <div className={`h-4 w-1/2 ${BAR}`} />
        </div>
        {Array.from({ length: ROW_COUNT }, (_, i) => (
          <div
            key={i}
            className={businessCardClass({
              className: 'flex items-start gap-3',
            })}
          >
            {isEntity ? null : (
              <div className="size-10 shrink-0 animate-pulse rounded-circle bg-surface-control" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className={`h-4 w-3/5 ${BAR}`} />
              <div className={`h-3 w-2/5 ${BAR}`} />
              <div className={`h-3 w-4/5 ${BAR}`} />
            </div>
          </div>
        ))}
      </div>
      {isEntity ? null : <div className="hidden lg:block" aria-hidden />}
    </div>
  );
}
