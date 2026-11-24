'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { CategoryNavLink } from './category-nav.types';

const NAV_TEXT_LINK_CLASS = 'text-muted underline-offset-2 hover:text-fg hover:underline';

export type CategoryNavUpLinksProps = {
  upHref: string;
  allHref: string;
  NavLink: CategoryNavLink;
};

/** `← Up` and `All categories` above a rail level below the root. */
export function CategoryNavUpLinks({ upHref, allHref, NavLink }: CategoryNavUpLinksProps) {
  const { t } = useI18n();
  return (
    <p className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-caption">
      <NavLink href={upHref} className={NAV_TEXT_LINK_CLASS}>
        {t('profile_categories_up')}
      </NavLink>
      <NavLink href={allHref} className={NAV_TEXT_LINK_CLASS}>
        {t('profile_categories_all')}
      </NavLink>
    </p>
  );
}
