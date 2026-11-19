'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronLeftIcon } from '@/icons';

import { BUSINESS_FOCUS_RING } from './classes';

export type BusinessCrumb = { label: string; href?: string };

/**
 * Where an entity page sits in Market (Favorites breadcrumb look): truncating links, the current
 * page last and not a link. Below `sm` only the parent stays, as a back link (`‹ Parent`): a
 * squeezed four-level trail is unreadable at phone width and the heading already names the page.
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
          const isParent = index === items.length - 2 && Boolean(item.href);
          return (
            <li
              key={`${item.label}-${index}`}
              className={`flex min-w-0 items-center gap-x-2 ${isParent ? '' : 'max-sm:hidden'}`}
            >
              {index > 0 ? (
                <span
                  className="shrink-0 text-fg-tertiary max-sm:hidden rtl:-scale-x-100"
                  aria-hidden
                >
                  ›
                </span>
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className={`inline-flex min-w-0 items-center gap-1 rounded-btn text-fg-secondary underline-offset-2 hover:text-fg hover:underline max-sm:min-h-11 max-sm:text-link ${BUSINESS_FOCUS_RING}`}
                  suppressHydrationWarning
                >
                  {isParent ? (
                    <ChevronLeftIcon
                      size={16}
                      className="shrink-0 sm:hidden rtl:rotate-180"
                    />
                  ) : null}
                  <span className="truncate">{item.label}</span>
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
