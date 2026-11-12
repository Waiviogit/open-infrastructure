import 'server-only';

import { queryApiAuthedFetch } from '@/shared/infrastructure/http/query-api-authed-fetch.server';

import type { OblOffsetPage } from '../../domain/obl-pagination.types';

export type OblOfferDraftView = {
  draftId: string;
  author: string;
  kind: 'offer' | 'request';
  fields: Record<string, unknown>;
  legalText: string | null;
  lastUpdated: number;
};

function oblDraftsPath(author: string, query: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) {
      q.set(k, v);
    }
  }
  const qs = q.toString();
  return `/query/v1/users/${encodeURIComponent(author)}/obl-drafts${qs ? `?${qs}` : ''}`;
}

export async function fetchOblDraftList(
  author: string,
  pagination?: { limit?: number; offset?: number },
): Promise<OblOffsetPage<OblOfferDraftView> | null> {
  const query: Record<string, string | undefined> = {};
  if (pagination?.limit !== undefined) {
    query.limit = String(pagination.limit);
  }
  if (pagination?.offset !== undefined) {
    query.offset = String(pagination.offset);
  }
  const result = await queryApiAuthedFetch<OblOffsetPage<OblOfferDraftView>>(
    oblDraftsPath(author, query),
    { method: 'GET' },
  );
  return result.ok ? result.value : null;
}

export async function fetchOblDraftOne(
  author: string,
  draftId: string,
): Promise<OblOfferDraftView | null> {
  const result = await queryApiAuthedFetch<OblOfferDraftView>(
    `/query/v1/users/${encodeURIComponent(author)}/obl-drafts/one?draftId=${encodeURIComponent(draftId)}`,
    { method: 'GET' },
  );
  return result.ok ? result.value : null;
}
