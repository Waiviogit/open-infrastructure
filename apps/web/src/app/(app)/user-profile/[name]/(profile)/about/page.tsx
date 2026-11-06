import { ProfileRouteStub } from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function UserProfileAboutPage() {
  return <ProfileRouteStub title="About" description="Extended profile information." />;
}
