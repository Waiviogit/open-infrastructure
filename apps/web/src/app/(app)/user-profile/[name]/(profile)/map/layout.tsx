// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function UserProfileMapShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mt-card-padding min-w-0">{children}</div>;
}
