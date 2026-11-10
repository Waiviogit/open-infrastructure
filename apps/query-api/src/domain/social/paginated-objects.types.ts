import type { ProjectedObject } from '../object-projection/projected-object.types';

export interface PaginatedProjectedObjects {
  items: ProjectedObject[];
  total: number;
  hasMore: boolean;
}

/** `GET /users/:name/following-objects` row: projected object + viewer follow flag. */
export type FollowingObjectItem = ProjectedObject & {
  /** True when the request viewer (`X-Viewer`) follows this object. */
  isCurrentFollowing: boolean;
};

export interface PaginatedFollowingObjects {
  items: FollowingObjectItem[];
  total: number;
  hasMore: boolean;
}
