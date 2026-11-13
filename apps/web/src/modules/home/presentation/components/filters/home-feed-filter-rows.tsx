'use client';

import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/icons';
import { OptimisticNavLink } from '@/shared/presentation';

/** Shared look of every rail row: same as the Discover type list. */
export function railItemClass(active: boolean): string {
  return [
    'flex w-full min-w-0 items-center gap-2 rounded-btn px-2 py-1.5 text-body-sm transition-colors',
    active
      ? 'bg-accent-soft font-weight-label text-accent'
      : 'text-fg-secondary hover:bg-ghost-surface hover:text-fg',
  ].join(' ');
}

/** `+N` new items, shown only when there is something new. */
export function HomeFeedFilterCount({ count, label }: { count: number | null; label: string }) {
  if (count == null || count <= 0) {
    return null;
  }
  return (
    <span className="ml-auto shrink-0 text-caption tabular-nums text-accent" aria-label={label}>
      +{count}
    </span>
  );
}

type HomeFeedFilterLinkProps = {
  href: string;
  active: boolean;
  children: ReactNode;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  title?: string;
};

/** One rail filter: replaces the URL (same route, new filter) and highlights optimistically. */
export function HomeFeedFilterLink({
  href,
  active,
  children,
  icon,
  leading,
  trailing,
  title,
}: HomeFeedFilterLinkProps) {
  return (
    <OptimisticNavLink
      href={href}
      method="replace"
      className={railItemClass(active)}
      aria-current={active ? 'page' : undefined}
      title={title}
    >
      {icon ? <Icon name={icon} size={16} className="shrink-0" /> : null}
      {leading}
      <span className="min-w-0 truncate">{children}</span>
      {trailing}
    </OptimisticNavLink>
  );
}

type HomeFeedFilterSectionProps = {
  id: string;
  title: ReactNode;
  count?: ReactNode;
  icon?: IconName;
  collapsed: boolean;
  onToggle: () => void;
  toggleLabel: string;
  children: ReactNode;
};

/** Collapsible rail section; the header only expands or collapses, it never filters. */
export function HomeFeedFilterSection({
  id,
  title,
  count,
  icon,
  collapsed,
  onToggle,
  toggleLabel,
  children,
}: HomeFeedFilterSectionProps) {
  const contentId = `${id}-content`;
  return (
    <section className="min-w-0">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 rounded-btn px-2 py-1.5 text-body-sm font-weight-strong text-fg hover:bg-ghost-surface"
        aria-expanded={!collapsed}
        aria-controls={collapsed ? undefined : contentId}
        aria-label={toggleLabel}
        onClick={onToggle}
      >
        {icon ? <Icon name={icon} size={16} className="shrink-0" /> : null}
        <span className="min-w-0 truncate">{title}</span>
        {count}
        <Icon
          name="chevron-down"
          size={16}
          className={['shrink-0 transition-transform', count ? '' : 'ml-auto', collapsed ? '-rotate-90' : ''].join(' ')}
        />
      </button>
      {collapsed ? null : (
        <div id={contentId} className="mt-1 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </section>
  );
}

export function HomeFeedFilterShowMore({
  pending,
  onClick,
  label,
}: {
  pending: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="self-start rounded-btn px-2 py-1 text-caption text-accent hover:underline disabled:opacity-60"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
    >
      {label}
    </button>
  );
}
