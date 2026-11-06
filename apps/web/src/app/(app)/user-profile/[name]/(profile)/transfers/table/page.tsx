import { createCookieAuthContextProvider } from '@/shared/infrastructure/auth/cookie-auth-context-provider';
import {
  buildInitialAdvancedReportRequest,
  HiveAdvancedReportTable,
} from '@/modules/user-wallet';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type UserProfileTransfersTablePageProps = {
  params: Promise<{ name: string }>;
};

export default async function UserProfileTransfersTablePage({
  params,
}: UserProfileTransfersTablePageProps) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);
  const auth = createCookieAuthContextProvider();
  const user = await auth.getUser();
  const initialRequest = buildInitialAdvancedReportRequest({
    profileAccount: accountName,
    viewer: user?.username ?? null,
  });

  return (
    <HiveAdvancedReportTable
      profileAccount={accountName}
      viewerUsername={user?.username ?? null}
      initialRequest={initialRequest}
      initialResult={{ report: null, error: null }}
      backHref={`/@${encodeURIComponent(accountName)}/transfers?type=HIVE`}
    />
  );
}
