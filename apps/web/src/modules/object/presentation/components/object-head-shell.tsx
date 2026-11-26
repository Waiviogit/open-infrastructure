'use client';

import { useMemo } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { ObjectHeroIdentity } from '../../domain/object-page.types';
import { objectStatusLabelKey, shouldShowObjectStatusBadge } from '../../domain/object-status-label';
import { resolveGalleryPhotosAlbum } from '../../domain/resolve-gallery-photos-album';
import { LeftObjectProfileSidebar } from './left-object-profile-sidebar';
import { ObjectHero } from './object-hero';
import {
  ObjectPageCenterSkeleton,
  ObjectPageLeftRailSkeleton,
  ObjectPagePrimaryNavSkeleton,
  ObjectPageRightRailSkeleton,
} from './object-page-loading-skeleton';
import { ObjectViewShell } from './object-view-shell';

/** Hero callbacks while pending: the controls are inert, the loaded page owns their state. */
const noop = (): undefined => undefined;

export type ObjectHeadShellProps = {
  head: ObjectHeroIdentity;
};

/**
 * Object page while the full model loads: the real hero painted from the object head (name, avatar,
 * cover, type, status) with inert controls, and skeletons for tabs, rails and the center column.
 * The loaded page renders the same hero in the same place, so only the skeletons change.
 */
export function ObjectHeadShell({ head }: ObjectHeadShellProps) {
  const { t } = useI18n();
  const galleryPhotosAlbum = useMemo(
    () => resolveGalleryPhotosAlbum(head.galleryAlbums, head.previewGallery),
    [head.galleryAlbums, head.previewGallery],
  );
  const statusBadgeLabel = shouldShowObjectStatusBadge(head.lifecycleStatus)
    ? t(objectStatusLabelKey(head.lifecycleStatus, head.objectTypeKey))
    : null;

  return (
    <div className="contents" data-testid="object-head-shell">
      <ObjectViewShell
        hero={
          <ObjectHero
            pending
            title={head.title}
            subtitleTitle={head.subtitleTitle}
            avatarUrl={head.avatarUrl}
            coverImageUrl={head.coverImageUrl}
            tagline={null}
            displayWeightLabel={head.displayWeightLabel}
            kindLabel={head.kindLabel}
            statusBadgeLabel={statusBadgeLabel}
            isEditMode={false}
            isFollowing={false}
            isBell={false}
            isFavorite={false}
            onToggleEdit={noop}
            onFollowToggle={noop}
            onBellToggle={noop}
            onFavoriteToggle={noop}
            primaryNav={<ObjectPagePrimaryNavSkeleton />}
            objectId={head.objectId}
            showInstacartButton={head.showInstacartButton}
            galleryPhotosAlbum={galleryPhotosAlbum}
            onOpenGalleryPhoto={noop}
          />
        }
        leftRail={
          <LeftObjectProfileSidebar>
            <ObjectPageLeftRailSkeleton />
          </LeftObjectProfileSidebar>
        }
        center={
          <div aria-busy="true" aria-label="Loading object content">
            <ObjectPageCenterSkeleton />
          </div>
        }
        rightRail={<ObjectPageRightRailSkeleton />}
      />
    </div>
  );
}
