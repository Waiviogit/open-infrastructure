import type { CatalogMessages } from '@/i18n/types';

export type ObjectSeoInput = {
  objectId: string;
  title: string;
  description: string | null;
  canonicalUrl: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  objectTypeKey: string;
  jsonLd: Record<string, unknown> | null;
  /** From `tagCategoryItem` values; omitted when empty. */
  keywords: string[] | null;
};

export type PostSeoInput = {
  authorName: string;
  permlink: string;
  title: string | null;
  excerpt: string;
  thumbnailUrl: string | null;
  videoThumbnailUrl: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  permalinkPath: string;
};

export type ProfileSeoInput = {
  name: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  reputation: number;
};

export type OfferSeoInput = {
  kind: 'offer' | 'request';
  offerId: string;
  version: number;
  name: string;
  /** Markdown or plain text; the builder turns it into a short plain excerpt. */
  description: string | null;
  authorName: string;
  /** Translated "Offer" / "Request", used when there is no description. */
  kindLabel: string;
};

export type SeoBuildContext = {
  locale: string;
  messages: CatalogMessages;
};
