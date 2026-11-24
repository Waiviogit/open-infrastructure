import {
  HIVE_PROFILE_FIELDS,
  HIVE_PROFILE_SOCIAL_FIELDS,
  HIVE_PROFILE_WALLET_FIELDS,
  type HiveProfileField,
} from '@opden-data-layer/hive-broadcast';

import type { MessageKey } from '@/i18n/types';
import {
  linkKindDisplayLabel,
  linkKindPublicIconSrc,
} from '@/modules/object/infrastructure/object-projected-fields';

export type ProfileSocialField = (typeof HIVE_PROFILE_SOCIAL_FIELDS)[number];
export type ProfileWalletField = (typeof HIVE_PROFILE_WALLET_FIELDS)[number];

/** Every editable key on `posting_json_metadata.profile`, as the form holds it (empty = unset). */
export type ProfileFormValues = Record<HiveProfileField, string>;

export const PROFILE_FORM_FIELDS: readonly HiveProfileField[] = HIVE_PROFILE_FIELDS;

export type ProfileTextFieldRow = {
  id: 'name' | 'about' | 'location' | 'email' | 'website';
  labelKey: MessageKey;
  placeholderKey: MessageKey;
  /** Legacy Waivio marks fields that are shown on the public profile. */
  isPublic: boolean;
  multiline: boolean;
};

export const PROFILE_TEXT_FIELDS: readonly ProfileTextFieldRow[] = [
  {
    id: 'name',
    labelKey: 'profile_name',
    placeholderKey: 'profile_name_placeholder',
    isPublic: false,
    multiline: false,
  },
  {
    id: 'about',
    labelKey: 'profile_about',
    placeholderKey: 'profile_about_placeholder',
    isPublic: false,
    multiline: true,
  },
  {
    id: 'location',
    labelKey: 'profile_location',
    placeholderKey: 'profile_location_placeholder',
    isPublic: true,
    multiline: false,
  },
  {
    id: 'email',
    labelKey: 'profile_email',
    placeholderKey: 'profile_email_placeholder',
    isPublic: true,
    multiline: false,
  },
  {
    id: 'website',
    labelKey: 'profile_website',
    placeholderKey: 'profile_website_placeholder',
    isPublic: true,
    multiline: false,
  },
];

export type ProfileLinkFieldRow = {
  id: ProfileSocialField | ProfileWalletField;
  /** Brand name — not translated. */
  label: string;
  iconSrc: string;
};

export const PROFILE_SOCIAL_ROWS: readonly ProfileLinkFieldRow[] = HIVE_PROFILE_SOCIAL_FIELDS.map(
  (id) => ({
    id,
    label: linkKindDisplayLabel(id),
    iconSrc: linkKindPublicIconSrc(id),
  }),
);

const WALLET_ICON_BASE = '/images/icons/cryptocurrencies';

export const PROFILE_WALLET_ROWS: readonly ProfileLinkFieldRow[] = [
  { id: 'bitcoin', label: 'Bitcoin', iconSrc: `${WALLET_ICON_BASE}/bitcoin.png` },
  { id: 'litecoin', label: 'Litecoin', iconSrc: `${WALLET_ICON_BASE}/litecoin.png` },
  { id: 'ethereum', label: 'Ethereum', iconSrc: `${WALLET_ICON_BASE}/ethereum.png` },
  {
    id: 'lightningBitcoin',
    label: 'Lightning Bitcoin',
    iconSrc: `${WALLET_ICON_BASE}/lightning_bitcoin.png`,
  },
];

export function emptyProfileFormValues(): ProfileFormValues {
  const values = {} as ProfileFormValues;
  for (const field of PROFILE_FORM_FIELDS) {
    values[field] = '';
  }
  return values;
}

/** Form values from a parsed `profile` object; non-string values are treated as unset. */
export function profileFormValuesFromProfile(
  profile: Readonly<Record<string, unknown>>,
): ProfileFormValues {
  const values = emptyProfileFormValues();
  for (const field of PROFILE_FORM_FIELDS) {
    const raw = profile[field];
    values[field] = typeof raw === 'string' ? raw : '';
  }
  return values;
}
