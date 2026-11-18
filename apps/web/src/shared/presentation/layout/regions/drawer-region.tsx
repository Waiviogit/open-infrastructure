'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** Sticky wrapper of the app header in `AppShell`. */
const APP_HEADER_STICKY_SLOT_SELECTOR = '.app-header-sticky-slot';

/**
 * Panel widths: `rail` matches the shell left rail; `wide` is a bit wider, for mobile
 * menus whose rows carry an icon, a label and a trailing mark (feed filters, discover types).
 */
const DRAWER_WIDTH_CLASS_NAMES = {
  rail: 'w-[min(100%,var(--shell-left-width))] max-w-[90vw]',
  wide: 'w-[min(17rem,85vw)]',
} as const;

export type DrawerRegionSize = keyof typeof DRAWER_WIDTH_CLASS_NAMES;

export type DrawerRegionProps = {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  children: ReactNode;
  /** Accessible label for the dialog. */
  ariaLabel: string;
  className?: string;
  /**
   * Start the drawer and its backdrop under the app header, so the header stays visible
   * and usable. Default: the drawer covers the full viewport height.
   */
  belowHeader?: boolean;
  /** Panel width. Default `rail`. */
  size?: DrawerRegionSize;
};

function readAppHeaderBottom(): number {
  const slot = document.querySelector(APP_HEADER_STICKY_SLOT_SELECTOR);
  if (!slot) {
    return 0;
  }
  return Math.max(0, slot.getBoundingClientRect().bottom);
}

/**
 * Bottom edge of the app header while `active`; `0` otherwise. Measured from the DOM
 * because the header height includes the safe-area inset and can grow past its token.
 */
function useAppHeaderBottom(active: boolean): number {
  const [bottom, setBottom] = useState(0);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    const update = () => setBottom(readAppHeaderBottom());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [active]);

  return active ? bottom : 0;
}

/**
 * Fixed overlay drawer for small screens. Backdrop click closes.
 */
export function DrawerRegion({
  open,
  onClose,
  side = 'left',
  children,
  ariaLabel,
  className = '',
  belowHeader = false,
  size = 'rail',
}: DrawerRegionProps) {
  const headerBottom = useAppHeaderBottom(open && belowHeader);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const position =
    side === 'left'
      ? 'left-0 border-r border-border'
      : 'right-0 border-l border-border';

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-0 z-[80] lg:hidden"
      style={headerBottom > 0 ? { top: headerBottom } : undefined}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        className={[
          'absolute top-0 h-full overflow-y-auto overscroll-contain bg-bg shadow-card-float',
          DRAWER_WIDTH_CLASS_NAMES[size],
          position,
          className,
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </aside>
    </div>
  );
}
