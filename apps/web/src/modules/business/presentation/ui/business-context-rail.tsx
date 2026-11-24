'use client';

import { useState, type ReactNode } from 'react';

import { ChevronDownIcon } from '@/icons';
import {
  MOBILE_MENU_PILL_CLASS,
  OptimisticNavLink,
  railItemClass,
  useEffectiveNav,
} from '@/shared/presentation';
import { DrawerRegion } from '@/shared/presentation/layout';

import { resolveActiveSubTab, type BusinessSubTab } from './business-sub-tabs';
import { BUSINESS_FOCUS_RING } from './classes';

export type BusinessRailItem = BusinessSubTab & {
  /** Optional trailing count / hint (tabular). */
  meta?: ReactNode;
};

export type BusinessRailNavProps = {
  items: readonly BusinessRailItem[];
  activeId: string;
  ariaLabel: string;
  /** Small uppercase section title above the rows (same as Discover rail headings). */
  heading?: string;
};

/** Vertical rail rows (Feed / Discover look); the clicked row turns active immediately. */
export function BusinessRailNav({
  items,
  activeId,
  ariaLabel,
  heading,
}: BusinessRailNavProps) {
  const effective = useEffectiveNav();
  const active = resolveActiveSubTab(items, effective, activeId);

  return (
    <nav aria-label={ariaLabel} className="flex min-w-0 flex-col gap-0.5">
      {heading ? (
        <p className="mb-1 px-2 text-caption font-weight-label uppercase tracking-loose text-fg-tertiary">
          {heading}
        </p>
      ) : null}
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <OptimisticNavLink
            key={item.id}
            href={item.href}
            prefetchShell
            aria-current={isActive ? 'page' : undefined}
            className={`${railItemClass(isActive)} min-h-9 max-lg:min-h-11 ${BUSINESS_FOCUS_RING}`}
          >
            {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.meta ? (
              <span className="ms-auto shrink-0 text-caption tabular-nums">
                {item.meta}
              </span>
            ) : null}
          </OptimisticNavLink>
        );
      })}
    </nav>
  );
}

export type BusinessMobileRailProps = {
  /** Trigger text: the active context (e.g. "Drafts"), like Feed's "My feed ▾". */
  label: string;
  ariaLabel: string;
  children: ReactNode;
};

/**
 * Below `lg` the context rail lives in a left drawer under the app header, opened from a
 * trigger named after the active row (Feed / Discover pattern). Navigating closes it. The
 * trigger draws the shared tinted pill (same as Feed's `My feed ▾` and the `All ▾` crumb)
 * inside a 44px tap area, the Market touch-target height.
 */
export function BusinessMobileRail({
  label,
  ariaLabel,
  children,
}: BusinessMobileRailProps) {
  const { pathname, search } = useEffectiveNav();
  const location = `${pathname}?${search}`;
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(location);
  if (open && location !== openedAt) {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className={`inline-flex min-h-11 max-w-full items-center rounded-pill ${BUSINESS_FOCUS_RING}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpenedAt(location);
          setOpen(true);
        }}
      >
        <span className={`${MOBILE_MENU_PILL_CLASS} max-w-full`}>
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDownIcon size={16} className="shrink-0" />
        </span>
      </button>
      <DrawerRegion
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        belowHeader
        size="wide"
        ariaLabel={ariaLabel}
      >
        <div className="flex flex-col gap-section-y-sm p-card-padding">
          {children}
        </div>
      </DrawerRegion>
    </div>
  );
}
