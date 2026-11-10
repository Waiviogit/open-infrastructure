'use client';

import { buildOdlObjectFollowOp } from '@opden-data-layer/hive-broadcast';

import { getWalletFacade } from '@/modules/auth';
import { awaitTrxConfirmation } from '@/modules/notifications';

/** Follows or unfollows `objectId` as `account` (flips `currentlyFollowing`) and waits for indexing. */
export async function broadcastObjectFollowToggle(
  account: string,
  objectId: string,
  currentlyFollowing: boolean,
  odlCustomJsonId: string,
): Promise<string> {
  const op = buildOdlObjectFollowOp({
    id: odlCustomJsonId,
    objectId,
    method: currentlyFollowing ? 'unfollow' : 'follow',
    required_posting_auths: [account],
  });
  const { transactionId } = await getWalletFacade().broadcast({ operations: [op] });
  await awaitTrxConfirmation(transactionId);
  return transactionId;
}
