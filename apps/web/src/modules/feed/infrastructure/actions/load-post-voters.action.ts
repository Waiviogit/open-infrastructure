'use server';

import { mapPostVotersPageApiToView } from '../../application/mappers/post-voters-from-api.mapper';
import type { PostVotersPageView } from '../../application/dto/post-voters.dto';
import {
  fetchPostVoters,
  type FetchPostVotersParams,
} from '../clients/post-voters.client';

export async function loadPostVotersAction(
  params: FetchPostVotersParams,
): Promise<PostVotersPageView | null> {
  const raw = await fetchPostVoters(params);
  if (!raw) {
    return null;
  }
  return mapPostVotersPageApiToView(raw);
}
