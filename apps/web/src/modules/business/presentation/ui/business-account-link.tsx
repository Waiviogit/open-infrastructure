'use client';

import Link from 'next/link';

import { UserAvatar } from '@/shared/presentation';

import { BUSINESS_FOCUS_RING } from './classes';

const AVATAR_SIZE = 20;

/** `(avatar) @account` inline link; `href` defaults to the Hive profile. */
export function BusinessAccountLink({
  account,
  href,
}: {
  account: string;
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/@${encodeURIComponent(account)}`}
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-btn align-middle text-link hover:underline ${BUSINESS_FOCUS_RING}`}
      suppressHydrationWarning
    >
      <UserAvatar username={account} size={AVATAR_SIZE} />
      <span className="min-w-0 truncate">@{account}</span>
    </Link>
  );
}
