'use client';

import type { HiveProfilePatch } from '@opden-data-layer/hive-broadcast';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { getWalletFacade } from '@/modules/auth';
import { hydrateWalletProviderFromStorage } from '@/modules/auth/presentation/hooks/hydrate-wallet-provider';
import { awaitTrxConfirmation } from '@/modules/notifications';
import {
  isHiveSignerRedirectError,
  mapEngineTokenBroadcastError,
} from '@/modules/user-wallet/domain/engine-token-broadcast-errors';
import { engineTokenBroadcastErrorMessageKey } from '@/modules/user-wallet/presentation/utils/engine-token-broadcast-error-message';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { revalidateUserSocialAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';

import {
  buildProfileUpdateOpAction,
  type BuildProfileUpdateOpErrorCode,
} from '../infrastructure/actions/profile-update.actions';
import { primeViewerSignature } from './viewer-signature';

export type SaveProfileOutcome = 'saved' | 'redirected' | 'failed';

function buildOpErrorMessageKey(code: BuildProfileUpdateOpErrorCode): string {
  switch (code) {
    case 'not_authorized':
      return 'wallet_broadcast_not_logged_in';
    case 'invalid_input':
      return 'profile_update_invalid';
    case 'no_changes':
      return 'profile_update_no_changes';
    case 'service_unavailable':
      return 'profile_update_unavailable';
  }
}

/** Build op on the server (live merge) → sign → confirm → refresh profile caches. */
export function useSaveProfile(username: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const save = useCallback(
    async (patch: HiveProfilePatch): Promise<SaveProfileOutcome> => {
      setErrorKey(null);
      setPending(true);
      try {
        const built = await buildProfileUpdateOpAction({ account: username, patch });
        if (!built.ok) {
          setErrorKey(buildOpErrorMessageKey(built.error));
          return 'failed';
        }
        hydrateWalletProviderFromStorage();
        const { transactionId } = await getWalletFacade().broadcast({
          operations: [built.operation],
        });
        primeViewerSignature(username, built.signature);
        await awaitTrxConfirmation(transactionId);
        try {
          await refreshAfterBroadcast(router, () => revalidateUserSocialAfterBroadcast(username));
        } catch {
          // Broadcast succeeded; cache refresh is best-effort.
        }
        return 'saved';
      } catch (error) {
        if (isHiveSignerRedirectError(error)) {
          return 'redirected';
        }
        setErrorKey(engineTokenBroadcastErrorMessageKey(mapEngineTokenBroadcastError(error)));
        return 'failed';
      } finally {
        setPending(false);
      }
    },
    [router, username],
  );

  return { save, pending, errorKey };
}
