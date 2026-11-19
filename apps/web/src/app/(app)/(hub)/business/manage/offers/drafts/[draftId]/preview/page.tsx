import { notFound, redirect } from 'next/navigation';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { businessRoutes } from '@/modules/business/domain/routes';
import { fetchOblDraftOne } from '@/modules/business/infrastructure/clients/obl-drafts.server';
import { requireBusinessUser } from '@/modules/business/infrastructure/require-business-user.server';
import { OfferDraftPreviewView } from '@/modules/business/presentation/components/offer-draft-preview-view';
import {
  emptyOfferFields,
  type OfferDraftFields,
} from '@/modules/business/domain/offer-form.types';

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return { title: messages.business_full_preview ?? 'Preview' };
}

export default async function BusinessOfferDraftPreviewPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { username } = await requireBusinessUser();
  const { draftId } = await params;
  const draft = await fetchOblDraftOne(username, draftId);
  if (!draft) {
    notFound();
  }
  if (draft.kind === 'request') {
    redirect(businessRoutes.offerDraftPreview('request', draftId));
  }

  const state = {
    kind: draft.kind,
    fields: { ...emptyOfferFields(), ...(draft.fields as OfferDraftFields) },
    legalText: draft.legalText ?? '',
  };

  return (
    <OfferDraftPreviewView draftId={draftId} state={state} author={username} />
  );
}
