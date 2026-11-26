import 'server-only';

import { cache } from 'react';

import type { UserProfileShellUser } from '../../domain/types/user-profile-shell-user';
import { fetchUserHead } from '../../infrastructure/clients/user-head.client';
import { mapViewToShellUser } from './get-user-profile.query';

export type UserHeadResult =
  | { kind: 'found'; user: UserProfileShellUser }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

/**
 * Profile head for the hero and the existence check (`[name]/layout`). Viewer fields are always
 * false: the head is painted before the viewer is known.
 */
export const getUserHeadQuery = cache(async (accountName: string): Promise<UserHeadResult> => {
  const outcome = await fetchUserHead(accountName);
  if (outcome.kind !== 'found') {
    return outcome;
  }
  return { kind: 'found', user: mapViewToShellUser(outcome.view) };
});
