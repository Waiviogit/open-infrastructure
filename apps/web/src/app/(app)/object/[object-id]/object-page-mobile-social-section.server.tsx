import { getObjectPostsFeedPageQuery } from '@/modules/feed';
import { MOBILE_SOCIAL_PREVIEW_FETCH_LIMIT } from '@/modules/object/infrastructure/clients/object-social.client';
import { ObjectRightSocialSection } from '@/modules/object/presentation/components/object-right-social-section';

export type ObjectPageMobileSocialSectionProps = {
  objectId: string;
  viewerUsername: string | null;
};

/** Social preview for standard-object mobile Details landing. */
export async function ObjectPageMobileSocialSection({
  objectId,
  viewerUsername,
}: ObjectPageMobileSocialSectionProps) {
  const socialPage = await getObjectPostsFeedPageQuery(
    objectId,
    { limit: MOBILE_SOCIAL_PREVIEW_FETCH_LIMIT },
    viewerUsername,
  );

  if (socialPage.items.length === 0) {
    return null;
  }

  return (
    <ObjectRightSocialSection
      objectId={objectId}
      page={socialPage}
      currentUsername={viewerUsername}
    />
  );
}
