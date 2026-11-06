import type { ReactNode } from 'react';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/** Prevent page scroll: messaging viewport fills remaining column height; scroll stays inside panels. */
export default function ProfileMessagesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mb-section-y-sm min-h-0 overflow-hidden">{children}</div>
  );
}
