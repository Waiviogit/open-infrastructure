'use server';

import {
  buildAccountUpdate2ProfileTypedOp,
  mergeHiveProfileMetadata,
  type AccountUpdate2ProfileOp,
} from '@opden-data-layer/hive-broadcast';

import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';

import { parseProfilePatch } from '../../domain/profile-form.schema';
import {
  currentProfileFromSnapshot,
  loadHiveAccountMetadata,
} from '../load-hive-account-metadata.server';

export type BuildProfileUpdateOpErrorCode =
  | 'not_authorized'
  | 'invalid_input'
  | 'no_changes'
  | 'service_unavailable';

export type BuildProfileUpdateOpResult =
  | { ok: true; operation: AccountUpdate2ProfileOp; signature: string | null }
  | { ok: false; error: BuildProfileUpdateOpErrorCode };

async function readViewerName(): Promise<string | null> {
  const user = await createCookieAuthContextProvider().getUser();
  const name = user?.username?.trim().toLowerCase();
  return name ? name : null;
}

/**
 * Merges the patch into the account's live `posting_json_metadata` (every other key kept) and
 * returns the `account_update2` for the viewer to sign. Only the signed-in account can be edited.
 */
export async function buildProfileUpdateOpAction(input: {
  account: string;
  patch: unknown;
}): Promise<BuildProfileUpdateOpResult> {
  try {
    const viewer = await readViewerName();
    const account = input.account.trim().replace(/^@/, '').toLowerCase();
    if (!viewer || viewer !== account) {
      return { ok: false, error: 'not_authorized' };
    }

    const patch = parseProfilePatch(input.patch);
    if (!patch) {
      return { ok: false, error: 'invalid_input' };
    }

    const snapshot = await loadHiveAccountMetadata(account);
    if (!snapshot) {
      return { ok: false, error: 'service_unavailable' };
    }

    const merged = mergeHiveProfileMetadata({ ...snapshot, patch });
    if (merged.changedFields.length === 0) {
      return { ok: false, error: 'no_changes' };
    }

    const signature = merged.profile['signature'];
    return {
      ok: true,
      operation: buildAccountUpdate2ProfileTypedOp({
        account,
        postingJsonMetadata: merged.postingJsonMetadata,
      }),
      signature: typeof signature === 'string' && signature.trim() ? signature : null,
    };
  } catch {
    return { ok: false, error: 'service_unavailable' };
  }
}

export type ViewerSignatureResult = {
  username: string | null;
  signature: string | null;
};

/** Profile signature of the signed-in viewer, read live from chain; never throws. */
export async function getViewerSignatureAction(): Promise<ViewerSignatureResult> {
  try {
    const viewer = await readViewerName();
    if (!viewer) {
      return { username: null, signature: null };
    }
    const snapshot = await loadHiveAccountMetadata(viewer);
    if (!snapshot) {
      return { username: viewer, signature: null };
    }
    const signature = currentProfileFromSnapshot(snapshot)['signature'];
    return {
      username: viewer,
      signature: typeof signature === 'string' && signature.trim() ? signature : null,
    };
  } catch {
    return { username: null, signature: null };
  }
}
