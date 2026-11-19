'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { BusinessMobileRail } from '../ui/business-context-rail';
import { BUSINESS_BREAK_TEXT } from '../ui/classes';
import { BusinessEmptyState } from '../ui/business-states';

export { BusinessEmptyState };

/**
 * Market page grid: the same three columns as the Feed hub (context rail | content | right
 * column). The section tabs live in the hub band (`HubMarketTabBand`), not here.
 */
export const BUSINESS_SHELL_GRID_CLASS = [
  'grid grid-cols-1 gap-card-padding',
  'lg:grid-cols-[minmax(0,var(--shell-left-width))_minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
].join(' ');

/** Rail sticks below the app header and the hub section nav, like the Feed filter rail. */
const RAIL_STICKY_CLASS = [
  'sticky top-[calc(var(--shell-header-height)+var(--hub-section-nav-height,0px)+var(--spacing-card))]',
  'max-h-[calc(100dvh-var(--shell-header-height)-var(--hub-section-nav-height,0px)-var(--spacing-card))]',
  'flex flex-col gap-section-y-sm overflow-y-auto overflow-x-hidden scrollbar-minimal',
].join(' ');

export type BusinessPageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** `list`: compact heading, content in the centre column. `entity`: display heading, wide content. */
  variant?: 'list' | 'entity';
  /** Above the heading (entity pages): back link / breadcrumbs. */
  breadcrumbs?: ReactNode;
  /** Context for this page (statuses, filters, steps): left rail on desktop, drawer below `lg`. */
  rail?: ReactNode;
  /** Mobile drawer trigger text: the active context, e.g. "Drafts". */
  railLabel?: string;
  /** Extra mobile-only controls next to the drawer trigger (e.g. the filter sheet button). */
  mobileControls?: ReactNode;
  children: ReactNode;
};

export function BusinessPageShell({
  title,
  subtitle,
  actions,
  variant = 'list',
  breadcrumbs,
  rail,
  railLabel,
  mobileControls,
  children,
}: BusinessPageShellProps) {
  const { t } = useI18n();
  const isEntity = variant === 'entity';

  return (
    <div
      className={`mt-card-padding pb-section-y ${BUSINESS_SHELL_GRID_CLASS}`}
    >
      <aside className="hidden min-w-0 lg:block">
        {rail ? <div className={RAIL_STICKY_CLASS}>{rail}</div> : null}
      </aside>

      <div className={`min-w-0 ${isEntity ? 'lg:col-span-2' : ''}`}>
        {breadcrumbs ? <div className="mb-3">{breadcrumbs}</div> : null}
        <header className="mb-card-padding flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1
              className={
                isEntity
                  ? `text-section font-display font-weight-display leading-display text-heading ${BUSINESS_BREAK_TEXT}`
                  : `text-body-lg font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`
              }
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-body-sm text-fg-secondary">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>

        {rail || mobileControls ? (
          <div className="mb-card-padding flex flex-wrap items-center justify-between gap-2 lg:hidden">
            {rail ? (
              <BusinessMobileRail
                label={railLabel ?? title}
                ariaLabel={t('business_context_aria')}
              >
                {rail}
              </BusinessMobileRail>
            ) : null}
            {mobileControls}
          </div>
        ) : null}

        {children}
      </div>

      {isEntity ? null : (
        <aside className="hidden min-w-0 lg:block" aria-hidden />
      )}
    </div>
  );
}
