import type { UserProfileView } from '../types/user-profile-view';

export interface UserProfileRepository {
  /** Viewer only: the profile does not depend on the locale (query-api ignores it). */
  findByName(name: string, viewer?: string | null): Promise<UserProfileView | null>;
}
