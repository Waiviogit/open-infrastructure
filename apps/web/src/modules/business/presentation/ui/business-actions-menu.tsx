'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { MoreHorizontalIcon } from '@/icons';

import { businessButtonClass } from './classes';

export type BusinessMenuAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * Secondary actions behind a "More" button (Hick: the page header keeps one primary and one
 * secondary action). Closes on outside click, Escape and selection; focus returns to the trigger.
 */
export function BusinessActionsMenu({
  label,
  actions,
}: {
  /** Accessible name and visible text of the trigger. */
  label: string;
  actions: readonly BusinessMenuAction[];
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={businessButtonClass({ variant: 'secondary' })}
      >
        <MoreHorizontalIcon size={18} />
        <span className="max-sm:sr-only">{label}</span>
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className="absolute end-0 top-full z-20 mt-1 min-w-[14rem] overflow-hidden rounded-card border border-border bg-surface-raised py-1 shadow-card-float"
        >
          {actions.map((action) => (
            <li key={action.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start text-body-sm text-fg transition-colors hover:bg-surface-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
              >
                {action.icon ? (
                  <span className="shrink-0 text-fg-secondary">
                    {action.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
