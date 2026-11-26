'use client';

import { profilePagePath } from '@/shared/routes/profile-page-path';

import { IntentPrefetchLink, type IntentPrefetchLinkProps } from './intent-prefetch-link';

export type ProfilePageLinkProps = Omit<IntentPrefetchLinkProps, 'href'> & {
  accountName: string;
};

/**
 * Client navigation to `/@account`: the visible link prefetches the profile skeleton (shell), a
 * pointed-at link the profile head, so the hero paints on click (see {@link IntentPrefetchLink}).
 */
export function ProfilePageLink({ accountName, ...props }: ProfilePageLinkProps) {
  return <IntentPrefetchLink href={profilePagePath(accountName)} {...props} />;
}
