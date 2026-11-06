import { Suspense } from 'react';

import { renderProfileMessagesLeftSidebar } from '@/modules/messaging/presentation/render-profile-messages-left-sidebar';
import { ProfileLeftRailSkeleton, renderProfileAccountSidebar } from '@/modules/user-profile';

type PageProps = {
  params: Promise<{ name: string; slug?: string[] }>;
  searchParams: Promise<{ channel?: string; peer?: string }>;
};

async function LeftSidebarCatchAllContent({ params, searchParams }: PageProps) {
  const { name, slug = [] } = await params;
  const accountName = decodeURIComponent(name);
  const first = slug[0] ?? '';

  if (first === 'messages') {
    return renderProfileMessagesLeftSidebar({ accountName, searchParams });
  }

  return renderProfileAccountSidebar(accountName);
}

export default function LeftSidebarCatchAllPage(props: PageProps) {
  return (
    <Suspense fallback={<ProfileLeftRailSkeleton />}>
      <LeftSidebarCatchAllContent {...props} />
    </Suspense>
  );
}
