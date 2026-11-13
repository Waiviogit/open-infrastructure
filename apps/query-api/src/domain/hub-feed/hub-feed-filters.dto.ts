import type { ProjectedObject } from '../object-projection/projected-object.types';
import type { HubFeedTab } from './hub-feed-filter';

export interface HubFeedFilterUserDto {
  name: string;
  avatarUrl: string | null;
  /** New items in the window on the requested tab; `null` when counters were unavailable. */
  count: number | null;
}

export interface HubFeedFilterObjectDto {
  objectId: string;
  objectType: string;
  count: number | null;
  /** Light projection (name, avatar); `null` when the object could not be resolved. */
  object: ProjectedObject | null;
}

export interface HubFeedFilterUsersPageDto {
  items: HubFeedFilterUserDto[];
  hasMore: boolean;
}

export interface HubFeedFilterObjectsPageDto {
  items: HubFeedFilterObjectDto[];
  hasMore: boolean;
}

export interface HubFeedFilterTypeDto {
  objectType: string;
  /** Sum of the type's object counts. */
  count: number | null;
  /** Followed active objects of this type. */
  total: number;
  objects: HubFeedFilterObjectsPageDto;
}

export interface HubFeedFiltersDto {
  tab: HubFeedTab;
  windowHours: number;
  /** Unix seconds: first hour counted. */
  windowStart: number;
  countsAvailable: boolean;
  users: HubFeedFilterUsersPageDto & { total: number };
  objectTypes: HubFeedFilterTypeDto[];
}
