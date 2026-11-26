import { Suspense } from 'react';
import { navigation } from 'next/cache';
import { notFound } from 'next/navigation';

import { getRequestUser } from '@/shared/infrastructure/auth/get-request-user.server';
import { JsonLdScript } from '@/seo';
import { ObjectPageRightRailSkeleton } from '@/modules/object/presentation/components/object-page-loading-skeleton';
import { objectTypeHasDetailsTab } from '@/modules/object/domain/object-page-url.constants';

import { loadObjectPageModel } from './object-page-model.server';
import { ObjectPageShellClient } from './object-page-shell-client';
import { ObjectPageRightRailSection } from './object-page-right-rail-section.server';
import { ObjectPageMobileSocialSection } from './object-page-mobile-social-section.server';

export type ObjectPageFullSectionProps = {
  objectId: string;
  locale: string;
  children: React.ReactNode;
};

/**
 * The loaded object page (viewer, full model, rails, tabs) behind the head shell.
 * `navigation()` keeps it out of link prefetches: a hovered link prefetches only the head.
 */
export async function ObjectPageFullSection({ objectId, locale, children }: ObjectPageFullSectionProps) {
  await navigation();
  const user = await getRequestUser();
  const viewerUsername = user?.username ?? null;

  const model = await loadObjectPageModel(objectId, locale, viewerUsername);
  if (!model) {
    notFound();
  }

  const followersTabCount =
    model.primaryTabs.find((tab) => tab.segment === 'followers')?.count ?? 0;
  const expertsTabCount =
    model.primaryTabs.find((tab) => tab.segment === 'experts')?.count ?? 0;

  const rightRailSlot = (
    <Suspense fallback={<ObjectPageRightRailSkeleton />}>
      <ObjectPageRightRailSection
        objectId={objectId}
        objectTypeKey={model.objectTypeKey}
        locale={locale}
        viewerUsername={viewerUsername}
        followersTabCount={followersTabCount}
        expertsTabCount={expertsTabCount}
      />
    </Suspense>
  );

  const mobileSocialSlot = objectTypeHasDetailsTab(model.objectTypeKey) ? (
    <Suspense fallback={null}>
      <ObjectPageMobileSocialSection objectId={objectId} viewerUsername={viewerUsername} />
    </Suspense>
  ) : undefined;

  return (
    <>
      <JsonLdScript data={model.seo?.json_ld} />
      <ObjectPageShellClient
        model={model}
        viewerUsername={viewerUsername}
        rightRailSlot={rightRailSlot}
        mobileSocialSlot={mobileSocialSlot}
      >
        {children}
      </ObjectPageShellClient>
    </>
  );
}
