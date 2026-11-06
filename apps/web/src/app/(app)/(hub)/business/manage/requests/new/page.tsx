import { redirect } from 'next/navigation';

import { businessRoutes } from '@/modules/business/domain/routes';
import { createOblDraftAction } from '@/modules/business/infrastructure/actions/obl-drafts.actions';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function BusinessRequestsNewPage() {
  const { username } = await requireBusinessUser();
  const result = await createOblDraftAction(username, {
    kind: 'request',
    fields: { name: '' },
  });
  if (result.ok) {
    redirect(businessRoutes.offerDraft('request', result.value.draftId));
  }
  redirect(businessRoutes.manageRequests);
}
