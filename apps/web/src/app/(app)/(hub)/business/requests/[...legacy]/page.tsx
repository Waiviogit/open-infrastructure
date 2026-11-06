import { redirectLegacyManagePath } from '@/modules/business/infrastructure/legacy-manage-redirect.server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function LegacyRequestsManageRedirect({
  params,
}: {
  params: Promise<{ legacy: string[] }>;
}) {
  const { legacy } = await params;
  redirectLegacyManagePath('request', legacy);
}
