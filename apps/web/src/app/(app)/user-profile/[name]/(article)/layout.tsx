import type { ReactNode } from 'react';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Full post pages: centered column, no profile hero or profile rails.
 */
export default function ArticleGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-container-post px-6 py-section-y-sm sm:px-8">
      {children}
    </div>
  );
}
