import { ProfileHeroSkeleton, ProfilePageBodySkeleton } from '@/modules/user-profile';
import { ScrollToTopOnEnter } from '@/shared/presentation';

/**
 * Prefetch of `/user-profile/:name` stops here — `(profile)/layout` is not rendered.
 * The skeleton is the first profile frame, so it resets the scroll: the layout's own
 * `ScrollToTopOnEnter` only mounts after the server renders the profile. Its hero mirrors
 * `UserHero`, so the real hero replaces it in place.
 */
export default function UserProfileNameLoading() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <ScrollToTopOnEnter routeKey="user-profile-route-loading" />
      <ProfileHeroSkeleton />
      <ProfilePageBodySkeleton />
    </div>
  );
}
