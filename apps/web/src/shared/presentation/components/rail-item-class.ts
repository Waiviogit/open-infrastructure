/**
 * Shared look of every left-rail row (Feed filters, Discover types, Market context rails):
 * icon + label, the active row tinted with the accent.
 */
export function railItemClass(active: boolean): string {
  return [
    'flex w-full min-w-0 items-center gap-2 rounded-btn px-2 py-1.5 text-body-sm transition-colors',
    active
      ? 'bg-accent-soft font-weight-label text-accent'
      : 'text-fg-secondary hover:bg-ghost-surface hover:text-fg',
  ].join(' ');
}
