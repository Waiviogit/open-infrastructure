'use client';

import { getViewerSignatureAction } from '../infrastructure/actions/profile-update.actions';

/** One chain read per account per page session; a profile save replaces the cached value. */
const signatureByAccount = new Map<string, Promise<string | null>>();

function accountKey(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

/** Viewer's profile signature, or `null` when unset or unavailable (never rejects). */
export function getViewerSignature(username: string): Promise<string | null> {
  const key = accountKey(username);
  if (!key) {
    return Promise.resolve(null);
  }
  const cached = signatureByAccount.get(key);
  if (cached) {
    return cached;
  }
  const pending = getViewerSignatureAction()
    .then((result) => (result.username === key ? result.signature : null))
    .catch(() => {
      signatureByAccount.delete(key);
      return null;
    });
  signatureByAccount.set(key, pending);
  return pending;
}

export function primeViewerSignature(username: string, signature: string | null): void {
  const key = accountKey(username);
  if (key) {
    signatureByAccount.set(key, Promise.resolve(signature));
  }
}
