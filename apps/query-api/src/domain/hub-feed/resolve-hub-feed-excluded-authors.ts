import type { UserAccountMutesRepository } from '../../repositories';

/** Viewer's own mutes; guests exclude nobody (Activity adds governance mutes on top). */
export async function resolveHubFeedExcludedAuthors(
  userAccountMutesRepo: UserAccountMutesRepository,
  viewer: string,
): Promise<string[]> {
  return viewer.length > 0 ? userAccountMutesRepo.listMutedForMuters([viewer]) : [];
}
