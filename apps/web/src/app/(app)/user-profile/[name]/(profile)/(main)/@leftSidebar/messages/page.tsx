import { Suspense } from 'react';

import { renderProfileMessagesLeftSidebar } from '@/modules/messaging/presentation/render-profile-messages-left-sidebar';
import { ProfileLeftRailSkeleton } from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ channel?: string; peer?: string }>;
};

async function MessagesLeftSidebarContent({ params, searchParams }: PageProps) {
  const { name } = await params;
  const accountName = decodeURIComponent(name);

  return renderProfileMessagesLeftSidebar({ accountName, searchParams });
}

export default function MessagesLeftSidebarPage(props: PageProps) {
  return (
    <Suspense fallback={<ProfileLeftRailSkeleton />}>
      <MessagesLeftSidebarContent {...props} />
    </Suspense>
  );
}
