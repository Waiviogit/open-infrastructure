import { renderProfileMessagesLeftSidebar } from '@/modules/messaging/presentation/render-profile-messages-left-sidebar';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type PageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ channel?: string; peer?: string }>;
};

export default async function MessagesLeftSidebarPage({
  params,
  searchParams,
}: PageProps) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);

  return renderProfileMessagesLeftSidebar({ accountName, searchParams });
}
