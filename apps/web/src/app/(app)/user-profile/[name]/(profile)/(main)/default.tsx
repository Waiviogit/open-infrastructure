/**
 * Next.js 16 parallel-route fallback for the `(main)` children slot.
 * Required so hard navigations (e.g. `/@account/transfers`) resolve with `@leftSidebar`.
 * @see https://nextjs.org/docs/messages/slot-missing-default
 */
// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function UserProfileMainDefault() {
  return null;
}
