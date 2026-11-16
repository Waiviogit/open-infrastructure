import { getFavoritesTypesQuery } from '../../application/queries/get-favorites.query';
import { FavoritesTypesMenuNav } from './favorites-types-menu-nav';
import { PROFILE_SUBMENU_CARD_CLASS } from './profile-submenu-classes';
import { UserMenuSkeleton } from './user-menu-skeleton';

export type FavoritesTypesMenuProps = {
  accountName: string;
};

/** Favorites types menu (profile submenu slot); data from the cached `favorites/types` read. */
export async function FavoritesTypesMenu({ accountName }: FavoritesTypesMenuProps) {
  const { items } = await getFavoritesTypesQuery(accountName);
  return <FavoritesTypesMenuNav accountName={accountName} items={items} />;
}

/** Placeholder of {@link FavoritesTypesMenu} while the types stream in. */
export function FavoritesTypesMenuSkeleton() {
  return (
    <div className={PROFILE_SUBMENU_CARD_CLASS}>
      <UserMenuSkeleton rows="submenu" />
    </div>
  );
}
