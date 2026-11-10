import type { UserAccountMutesRepository } from '../../repositories';
import type { GovernanceResolverService } from '../governance';

/**
 * Authors hidden from object activity for this request: governance mutes plus the viewer's own mutes.
 * Shared by every object-activity read (list, followed feed, single message) so visibility stays identical.
 */
export async function resolveActivityExcludedAuthors(
  governanceResolver: GovernanceResolverService,
  userAccountMutesRepo: UserAccountMutesRepository,
  governanceObjectIdFromHeader: string | undefined,
  viewerAccount: string | undefined,
): Promise<string[]> {
  const governance = await governanceResolver.resolveMergedForObjectView(
    governanceObjectIdFromHeader,
  );

  const viewer = viewerAccount?.trim() ?? '';
  const viewerMutes =
    viewer.length > 0 ? await userAccountMutesRepo.listMutedForMuters([viewer]) : [];

  return [...new Set([...governance.muted, ...viewerMutes].filter((v) => v.trim().length > 0))];
}
