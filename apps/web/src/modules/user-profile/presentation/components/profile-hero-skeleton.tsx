/**
 * Profile hero placeholders that mirror `UserHero` (no-cover band, 96 px avatar, name and stats,
 * primary tab row), so the real hero replaces them without a jump. No hooks — safe in server
 * `loading.tsx` files and in client trees.
 */
import { ShellFullBleedBand, ShellInset } from '@/shared/presentation/layout';
import {
  HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS,
  horizontalTabNavScrollShellClass,
} from '@/shared/presentation/layout/horizontal-tab-nav-classes';

/** Primary profile tabs in `UserMenu` (feed, map, favorites, transfers, followers, expertise, about). */
export const USER_MENU_PRIMARY_TAB_COUNT = 7;

export const PROFILE_TAB_SKELETON_CLASS =
  'inline-flex h-10 min-w-[3.5rem] shrink-0 animate-pulse border-b-2 border-transparent px-3 py-2.5';

/** Static primary tab row (the hook-based `UserMenuSkeleton` needs the pending-nav provider). */
export function ProfilePrimaryNavSkeleton() {
  return (
    <div className={horizontalTabNavScrollShellClass('gutter')} aria-hidden>
      <div className={`${HORIZONTAL_TAB_NAV_PRIMARY_ROW_CLASS} mx-auto w-max`}>
        {Array.from({ length: USER_MENU_PRIMARY_TAB_COUNT }).map((_, i) => (
          <div key={i} className={PROFILE_TAB_SKELETON_CLASS} />
        ))}
      </div>
    </div>
  );
}

/** Whole hero placeholder: same bands, offsets and sizes as `UserHero` without a cover photo. */
export function ProfileHeroSkeleton() {
  return (
    <div aria-hidden>
      <ShellFullBleedBand className="relative overflow-x-clip">
        <div className="absolute inset-x-0 top-0 h-36 overflow-hidden border-b border-border bg-gradient-to-br from-accent/30 to-surface" />
        <ShellInset className="relative z-10 pt-36">
          <div className="relative -mt-12 flex flex-col items-center gap-4 pb-4 text-center lg:flex-row lg:items-end lg:text-left">
            <div className="size-24 shrink-0 animate-pulse self-center rounded-circle border-4 border-bg bg-surface-control lg:self-start" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <div className="text-section">
                <span className="mx-auto inline-block w-48 animate-pulse rounded-btn bg-surface-control lg:mx-0">
                  &nbsp;
                </span>
              </div>
              <div className="mx-auto hidden h-4 w-72 max-w-full animate-pulse rounded-btn bg-surface-control lg:mx-0 lg:block" />
            </div>
          </div>
        </ShellInset>
      </ShellFullBleedBand>
      <ShellFullBleedBand className="bg-surface shadow-card">
        <ShellInset className="pt-0">
          <div className="shell-profile-grid grid grid-cols-1 gap-x-card-padding lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]">
            <div className="min-w-0 lg:col-start-2">
              <ProfilePrimaryNavSkeleton />
            </div>
          </div>
        </ShellInset>
      </ShellFullBleedBand>
    </div>
  );
}
