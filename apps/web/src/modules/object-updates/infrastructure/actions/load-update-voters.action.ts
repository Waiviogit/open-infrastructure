'use server';

import type { UpdateVotersResponseView } from '../../application/dto/update-voters.dto';
import { fetchUpdateVoters } from '../clients/update-voters.client';

export async function loadUpdateVotersAction(
  objectId: string,
  updateId: string,
): Promise<UpdateVotersResponseView | null> {
  return fetchUpdateVoters(objectId, updateId);
}
