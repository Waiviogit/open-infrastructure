import type { MessageKey } from '@/i18n/types';

/** Catalog keys that name an object type: `object_type_<type>`. */
export type ObjectTypeLabelKey = Extract<MessageKey, `object_type_${string}`>;

/**
 * Every `object_type_*` key of the en-US catalog. Typed as a full record, so a new
 * `object_type_*` catalog key fails the typecheck until it is listed here.
 */
const OBJECT_TYPE_LABEL_KEYS: Readonly<Record<ObjectTypeLabelKey, true>> = {
  object_type_affiliate: true,
  object_type_app: true,
  object_type_book: true,
  object_type_business: true,
  object_type_car: true,
  object_type_commodity: true,
  object_type_company: true,
  object_type_crypto: true,
  object_type_currencies: true,
  object_type_currency: true,
  object_type_dish: true,
  object_type_drink: true,
  object_type_hashtag: true,
  object_type_hotel: true,
  object_type_indices: true,
  object_type_list: true,
  object_type_motel: true,
  object_type_newsfeed: true,
  object_type_note: true,
  object_type_organization: true,
  object_type_page: true,
  object_type_person: true,
  object_type_place: true,
  object_type_product: true,
  object_type_resort: true,
  object_type_restaurant: true,
  object_type_service: true,
  object_type_service_offer: true,
  object_type_service_request: true,
  object_type_shop: true,
  object_type_stocks: true,
  object_type_test: true,
  object_type_webpage: true,
  object_type_widget: true,
};

function isObjectTypeLabelKey(key: string): key is ObjectTypeLabelKey {
  return Object.hasOwn(OBJECT_TYPE_LABEL_KEYS, key);
}

/** Catalog key naming an API object type (`&` dropped), or null when the catalog has no name for it. */
export function objectTypeLabelKey(
  objectType: string,
): ObjectTypeLabelKey | null {
  const key = `object_type_${objectType.replace(/&/g, '')}`;
  return isObjectTypeLabelKey(key) ? key : null;
}
