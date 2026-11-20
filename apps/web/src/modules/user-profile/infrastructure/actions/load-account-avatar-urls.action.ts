'use server';

import { isHiveAccountName, normalizeHiveAccountInput } from '@opden-data-layer/common';

import { createGetUserProfileQuery } from '../../application/queries/get-user-profile.query';
import { createHttpUserProfileRepository } from '../repositories/user-profile.repository';

/** Same query-api request (and `'use cache'` entry) as the profile hero and the header. */
const getUserProfileQuery = createGetUserProfileQuery(createHttpUserProfileRepository());

/** Matches the Keychain sign-in history cap; guards the action against large inputs. */
const MAX_ACCOUNTS_PER_CALL = 5;

async function loadAvatarUrl(name: string): Promise<string | null> {
  try {
    const profile = await getUserProfileQuery(name);
    return profile?.avatarUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Query-api avatar URLs for a few accounts (sign-in history), from the same cached profile query
 * as the profile hero and the header. Unknown or invalid names map to `null`; never throws.
 */
export async function loadAccountAvatarUrlsAction(
  names: readonly string[],
): Promise<Record<string, string | null>> {
  const accounts = [
    ...new Set(
      names
        .slice(0, MAX_ACCOUNTS_PER_CALL)
        .map((name) => normalizeHiveAccountInput(name))
        .filter((name) => isHiveAccountName(name)),
    ),
  ];
  const urls = await Promise.all(accounts.map((name) => loadAvatarUrl(name)));
  return Object.fromEntries(accounts.map((name, i) => [name, urls[i] ?? null]));
}
