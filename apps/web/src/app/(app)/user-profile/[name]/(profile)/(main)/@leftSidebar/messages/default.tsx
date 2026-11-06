/**
 * Parallel-route fallback for profile messages left rail (soft navigation / reload).
 * @see https://nextjs.org/docs/messages/slot-missing-default
 */
// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export { default } from './page';
