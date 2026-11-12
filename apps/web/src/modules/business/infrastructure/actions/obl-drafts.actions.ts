'use server';

import type { Result } from '@/shared/domain/result';
import {
  queryApiAuthedFetch,
  type QueryApiAuthedError,
} from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { OblOfferDraftView } from '../clients/obl-drafts.server';

function oblDraftsBase(author: string) {
  return `/query/v1/users/${encodeURIComponent(author)}/obl-drafts`;
}

export async function listOblDraftsAction(
  author: string,
): Promise<Result<OblOfferDraftView[], QueryApiAuthedError>> {
  return queryApiAuthedFetch<OblOfferDraftView[]>(oblDraftsBase(author), {
    method: 'GET',
  });
}

export async function createOblDraftAction(
  author: string,
  body: {
    draftId?: string;
    kind: 'offer' | 'request';
    fields?: Record<string, unknown>;
    legalText?: string | null;
  },
): Promise<Result<OblOfferDraftView, QueryApiAuthedError>> {
  return queryApiAuthedFetch<OblOfferDraftView>(oblDraftsBase(author), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchOblDraftAction(
  author: string,
  draftId: string,
  body: {
    kind?: 'offer' | 'request';
    fields?: Record<string, unknown>;
    legalText?: string | null;
  },
): Promise<Result<OblOfferDraftView, QueryApiAuthedError>> {
  return queryApiAuthedFetch<OblOfferDraftView>(
    `${oblDraftsBase(author)}?draftId=${encodeURIComponent(draftId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function deleteOblDraftAction(
  author: string,
  draftId: string,
): Promise<Result<void, QueryApiAuthedError>> {
  return queryApiAuthedFetch<void>(
    `${oblDraftsBase(author)}?draftId=${encodeURIComponent(draftId)}`,
    { method: 'DELETE' },
  );
}
