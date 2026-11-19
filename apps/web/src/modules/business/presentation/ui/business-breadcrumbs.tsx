'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { BUSINESS_FOCUS_RING } from './classes';

export type BusinessCrumb = { label: string; href?: string };

/**
 * Where an entity page sits in Market (Favorites breadcrumb look): truncating links, the current
 * page last and not a link.
 */
export function BusinessBreadcrumbs({
  items,
}: {
  items: readonly BusinessCrumb[];
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('business_breadcrumbs_aria')} className="min-w-0">
      <ol className="flex min-w-0 list-none flex-nowrap items-center gap-x-2 overflow-hidden p-0 text-body-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex min-w-0 items-center gap-x-2"
            >
              {index > 0 ? (
                <span
                  className="shrink-0 text-fg-tertiary rtl:-scale-x-100"
                  aria-hidden
                >
                  ›
                </span>
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={`truncate rounded-btn text-fg-secondary underline-offset-2 hover:text-fg hover:underline ${BUSINESS_FOCUS_RING}`}
                  suppressHydrationWarning
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="truncate font-weight-label text-fg"
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
