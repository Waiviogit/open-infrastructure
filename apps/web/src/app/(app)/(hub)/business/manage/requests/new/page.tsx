import { redirect } from 'next/navigation';

import { businessRoutes } from '@/modules/business/domain/routes';
import { createOblDraftAction } from '@/modules/business/infrastructure/actions/obl-drafts.actions';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';

// Deliberate Block: creates a draft on request and answers with a 307 to its editor — there is no UI
// to stream, and a redirect inside <Suspense> would arrive as a client redirect after a 200.
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
