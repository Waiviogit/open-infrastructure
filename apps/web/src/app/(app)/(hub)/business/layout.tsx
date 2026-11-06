import type { ReactNode } from 'react';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/** Shared wrapper for `/business/*` routes (sub-nav lives in BusinessPageShell). */
export default function BusinessLayout({ children }: { children: ReactNode }) {
  return children;
}
