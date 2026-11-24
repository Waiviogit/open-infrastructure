import type { ProjectedObject } from '../object-projection/projected-object.types';

export interface DiscoverObjectsResponseDto {
  items: ProjectedObject[];
  cursor: string | null;
  hasMore: boolean;
}

export interface DiscoverUserResult {
  name: string;
  profile_image: string | null;
  reputation: number;
  wobjects_weight: number;
  followers_count: number;
  is_following: boolean;
}

export interface DiscoverUsersResponseDto {
  items: DiscoverUserResult[];
  cursor: string | null;
  hasMore: boolean;
}

export interface DiscoverTagCategoryItemDto {
  value: string;
  count: number;
}

export interface DiscoverTagCategorySectionDto {
  category: string;
  items: DiscoverTagCategoryItemDto[];
}

export interface DiscoverTagCategoriesResponseDto {
  categories: DiscoverTagCategorySectionDto[];
}

export interface DiscoverCategoryItemDto {
  name: string;
  /** Live count of active groups (`COALESCE(meta_group_id, object_id)`) under the lineage. */
  objects_count: number;
  has_children: boolean;
}

export interface DiscoverCategoriesResponseDto {
  items: DiscoverCategoryItemDto[];
  /** Root only: more categories pass the display rules than the root limit shows. */
  show_other: boolean;
}

export interface DiscoverSectionDto {
  categoryName: string;
  /** Top objects of the child category by rank, one per group. */
  items: ProjectedObject[];
  /** Groups in the child category (its category tree count). */
  totalObjects: number;
}

export interface DiscoverSectionsResponseDto {
  sections: DiscoverSectionDto[];
  cursor: string | null;
  hasMore: boolean;
}
