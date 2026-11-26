import { profileSectionTabClass } from '@/shared/presentation/components/profile-section-tab-classes';
import { ShellFullBleedBand, ShellInset } from '@/shared/presentation/layout';
import { HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS } from '@/shared/presentation/layout/horizontal-tab-nav-classes';

import { ObjectViewShell } from './object-view-shell';

const PRIMARY_NAV_SKELETON_TABS = 4;

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-btn bg-surface-control ${className}`} aria-hidden />;
}

/** One text line of the given type scale, so the placeholder keeps the real line height. */
function PulseLine({ className, width }: { className: string; width: string }) {
  return (
    <div className={className} aria-hidden>
      <span className={`inline-block animate-pulse rounded-btn bg-surface-control ${width}`}>
        &nbsp;
      </span>
    </div>
  );
}

/** Primary tab row placeholder: same tab box as `ObjectPrimaryNav`, labels pulse. */
export function ObjectPagePrimaryNavSkeleton() {
  return (
    <div className={`${HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS} justify-center gap-x-1`} aria-hidden>
      {Array.from({ length: PRIMARY_NAV_SKELETON_TABS }).map((_, i) => (
        <span key={i} className={profileSectionTabClass(false)}>
          <span className="inline-block w-16 animate-pulse rounded-btn bg-surface-control">&nbsp;</span>
        </span>
      ))}
    </div>
  );
}

/** Mirrors `ObjectHero` bands and grid, so the real hero replaces it without a jump. */
function ObjectPageHeroSkeleton() {
  return (
    <div aria-hidden>
      <ShellFullBleedBand className="relative overflow-hidden">
        <div className="absolute inset-0 bg-nav-bg" />
        <ShellInset className="relative z-10 pb-5 pt-6">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-[auto] sm:items-end sm:gap-x-4 sm:gap-y-0">
            <div className="relative shrink-0 self-start sm:col-start-1 sm:row-start-1 sm:self-end">
              <PulseBlock className="size-24 rounded-card" />
            </div>
            <div className="col-span-2 min-w-0 pb-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <PulseLine className="text-display leading-compressed" width="w-48" />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <PulseBlock className="h-5 w-16 rounded-pill" />
              </div>
            </div>
            <div className="col-start-2 row-start-1 flex gap-1.5 justify-self-end sm:col-start-3 sm:row-start-1 sm:gap-2 sm:self-end sm:pb-1">
              <PulseBlock className="h-9 w-20 rounded-pill" />
              <PulseBlock className="size-9 rounded-circle sm:size-10" />
            </div>
          </div>
        </ShellInset>
      </ShellFullBleedBand>
      <ShellFullBleedBand className="border-t border-border bg-bg shadow-card">
        <ShellInset className="pb-3 pt-0">
          <ObjectPagePrimaryNavSkeleton />
        </ShellInset>
      </ShellFullBleedBand>
    </div>
  );
}

export function ObjectPageLeftRailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <PulseBlock className="h-4 w-20" />
      {Array.from({ length: 4 }).map((_, i) => (
        <PulseBlock key={i} className="h-8 w-full" />
      ))}
      <PulseBlock className="mt-6 h-4 w-24" />
      {Array.from({ length: 3 }).map((_, i) => (
        <PulseBlock key={`b-${i}`} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function ObjectPageCenterSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <PulseBlock className="h-5 w-40" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface/80 p-card-padding shadow-whisper">
          <div className="flex gap-3">
            <PulseBlock className="size-16 shrink-0 rounded-btn" />
            <div className="min-w-0 flex-1 space-y-2">
              <PulseBlock className="h-4 w-3/4" />
              <PulseBlock className="h-3 w-1/2" />
              <PulseBlock className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ObjectPageRightRailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {Array.from({ length: 2 }).map((_, section) => (
        <div key={section} className="space-y-2">
          <PulseBlock className="h-4 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <PulseBlock className="size-12 shrink-0 rounded-btn" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <PulseBlock className="h-3 w-full" />
                <PulseBlock className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ObjectPageUpdatesFeedSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <PulseBlock key={i} className="h-8 w-20" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface/80 p-card-padding">
          <div className="flex gap-3">
            <PulseBlock className="size-10 shrink-0 rounded-circle" />
            <div className="min-w-0 flex-1 space-y-2">
              <PulseBlock className="h-4 w-32" />
              <PulseBlock className="h-3 w-full" />
              <PulseBlock className="h-3 w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Route-level loading shell — mirrors {@link ObjectViewShell} layout. */
export function ObjectPageLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading object">
      <ObjectViewShell
        hero={<ObjectPageHeroSkeleton />}
        leftRail={<ObjectPageLeftRailSkeleton />}
        center={<ObjectPageCenterSkeleton />}
        rightRail={<ObjectPageRightRailSkeleton />}
      />
    </div>
  );
}
