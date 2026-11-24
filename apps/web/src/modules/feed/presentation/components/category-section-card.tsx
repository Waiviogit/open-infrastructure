'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronRightIcon } from '@/icons';
import type { CategoryNavLink } from '@/shared/presentation/category-nav';

import type { ProjectedObjectView } from '../../application/dto/object-fields';
import { ObjectCard } from './object-card';

export type CategorySectionCardProps = {
  headingId: string;
  /** Category name (or a node label such as Uncategorized). */
  title: string;
  /** The category page: the title, its chevron and Show more link there. */
  href: string;
  /** Objects in the category (all of them, not only the previews). */
  totalObjects: number;
  /** Preview objects. */
  items: readonly ProjectedObjectView[];
  NavLink: CategoryNavLink;
  viewerUsername?: string | null;
  onRequireLogin?: () => void;
};

/**
 * One category block of a category page (profile Favorites, Discover): the title as a link with
 * a chevron, the object count, preview cards and, when the category holds more objects than its
 * previews, `Show more {category}` to the category page.
 */
export function CategorySectionCard({
  headingId,
  title,
  href,
  totalObjects,
  items,
  NavLink,
  viewerUsername,
  onRequireLogin,
}: CategorySectionCardProps) {
  const { t } = useI18n();
  const showMore = totalObjects > items.length;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-card border border-border bg-surface/60 p-card-padding"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-heading font-label text-body-lg">
          <NavLink
            href={href}
            className="inline-flex items-center gap-1 text-fg underline-offset-2 hover:underline"
          >
            <span>{title}</span>
            <ChevronRightIcon size={18} className="shrink-0 text-accent" />
          </NavLink>
        </h2>
        <p className="text-caption text-fg-secondary tabular-nums">
          {t('profile_shop_object_count').replace(
            '{count}',
            String(totalObjects),
          )}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-body-sm text-muted">
          {t('profile_shop_no_preview')}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-card-padding">
          {items.map((object) => (
            <ObjectCard
              key={object.object_id}
              object={object}
              viewerUsername={viewerUsername}
              onRequireLogin={onRequireLogin}
            />
          ))}
        </ul>
      )}
      {showMore ? (
        <p className="mt-card-padding">
          <NavLink
            href={href}
            className="text-body-sm font-weight-label text-accent underline-offset-2 hover:underline"
          >
            {t('category_section_show_more').replace('{category}', title)}
          </NavLink>
        </p>
      ) : null}
    </section>
  );
}
