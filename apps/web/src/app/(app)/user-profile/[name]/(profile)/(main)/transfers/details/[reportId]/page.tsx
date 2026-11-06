import { ProfileRouteStub } from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string; reportId: string }>;
};

export default async function UserProfileTransfersReportPage({ params }: PageProps) {
  const { reportId } = await params;
  return (
    <ProfileRouteStub
      title={`Report ${reportId}`}
      description="Single transfer report details."
    />
  );
}
