import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BusinessOfferEditorClient } from '@/modules/business';
import { businessRoutes } from '@/modules/business/domain/routes';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import {
  draftMetadata,
  loadOblDraftForPage,
} from '@/modules/business/infrastructure/business-metadata.server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ draftId: string }>;
}): Promise<Metadata> {
  const { username } = await requireBusinessUser();
  const { draftId } = await params;
  return draftMetadata(username, draftId);
}

export default async function BusinessOfferDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { draftId } = await params;
  const draft = await loadOblDraftForPage(username, draftId);
  if (!draft) {
    notFound();
  }
  if (draft.kind === 'request') {
    redirect(businessRoutes.offerDraft('request', draftId));
  }
  return <BusinessOfferEditorClient username={username} draft={draft} />;
}
