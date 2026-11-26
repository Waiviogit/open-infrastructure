import type {
  ProjectedGalleryAlbum,
  ProjectedGalleryPhoto,
  ProjectedObject,
} from '../object-projection/projected-object.types';

/**
 * `GET /objects/:objectId/head` — the hero subset of {@link ProjectedObject}, viewer-independent.
 * `fields` holds only `name`, `title`, `image`, `imageBackground`, `identifier` (when resolved).
 */
export type ObjectHeadDto = Pick<
  ProjectedObject,
  'object_id' | 'object_type' | 'semantic_type' | 'status' | 'weight' | 'fields'
> & {
  /** Gallery built from the avatar only (the hero opens the Photos album from it). */
  previewGallery: ProjectedGalleryPhoto[];
  galleryAlbums: ProjectedGalleryAlbum[];
};
