import {
  RightSidebar,
} from '@/modules/user-profile';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function UserProfileAboutShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);

  return (
    <div
      className={[
        'mt-card-padding grid grid-cols-1 gap-card-padding',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
      ].join(' ')}
    >
      <main className="min-h-[12rem] min-w-0">{children}</main>
      <div className="hidden min-w-0 lg:block">
        <RightSidebar accountName={accountName} />
      </div>
    </div>
  );
}
