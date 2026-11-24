import {
  HIVE_PROFILE_SOCIAL_FIELDS,
  HIVE_PROFILE_WALLET_FIELDS,
  type HiveProfileField,
  type HiveProfilePatch,
} from '@opden-data-layer/hive-broadcast';
import { z } from 'zod';

import type { MessageKey } from '@/i18n/types';

import { PROFILE_FORM_FIELDS, type ProfileFormValues } from './profile-fields';

/** Keeps one profile update well under the Hive transaction size limit. */
export const PROFILE_VALUE_MAX_LENGTH = 5000;

export type ProfileFieldErrorCode =
  | 'too_long'
  | 'social_invalid'
  | 'whatsapp_invalid'
  | 'wallet_invalid'
  | 'email_invalid'
  | 'url_invalid';

export type ProfileFieldErrors = Partial<Record<HiveProfileField, ProfileFieldErrorCode>>;

const SOCIAL_HANDLE_PATTERN = /^[0-9A-Za-z._-]+$/;
const WHATSAPP_PATTERN = /^\+?[0-9]{6,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const BASE58_BODY = '[1-9A-HJ-NP-Za-km-z]';
const BECH32_BODY = '[02-9ac-hj-np-z]';

/** Format checks only (no checksum): enough to catch a pasted handle or a wrong coin. */
const WALLET_PATTERNS: Record<(typeof HIVE_PROFILE_WALLET_FIELDS)[number], readonly RegExp[]> = {
  bitcoin: [new RegExp(`^bc1${BECH32_BODY}{11,71}$`, 'i'), new RegExp(`^[13]${BASE58_BODY}{25,34}$`)],
  litecoin: [
    new RegExp(`^ltc1${BECH32_BODY}{11,71}$`, 'i'),
    new RegExp(`^[LM3]${BASE58_BODY}{26,33}$`),
  ],
  ethereum: [/^0x[0-9a-fA-F]{40}$/],
  lightningBitcoin: [
    new RegExp(`^lnurl1${BECH32_BODY}+$`, 'i'),
    /^[a-z0-9._-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i,
  ],
};

const SOCIAL_FIELD_SET = new Set<string>(HIVE_PROFILE_SOCIAL_FIELDS);
const WALLET_FIELD_SET = new Set<string>(HIVE_PROFILE_WALLET_FIELDS);

function isWalletField(field: string): field is (typeof HIVE_PROFILE_WALLET_FIELDS)[number] {
  return WALLET_FIELD_SET.has(field);
}

function isHttpUrl(value: string): boolean {
  const candidate = URL_SCHEME_PATTERN.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  return URL_SCHEME_PATTERN.test(value) && isHttpUrl(value);
}

/** Value as it is stored: trimmed; social handles lose a leading `@`. Signature keeps inner whitespace. */
export function normalizeProfileValue(field: HiveProfileField, raw: string): string {
  const trimmed = raw.trim();
  if (SOCIAL_FIELD_SET.has(field)) {
    return trimmed.replace(/^@+/, '');
  }
  return trimmed;
}

/** Error for a normalized, non-empty value; empty values always pass (they remove the key). */
export function validateProfileValue(
  field: HiveProfileField,
  value: string,
): ProfileFieldErrorCode | null {
  if (value === '') {
    return null;
  }
  if (value.length > PROFILE_VALUE_MAX_LENGTH) {
    return 'too_long';
  }
  if (field === 'whatsapp') {
    return WHATSAPP_PATTERN.test(value) ? null : 'whatsapp_invalid';
  }
  if (SOCIAL_FIELD_SET.has(field)) {
    return SOCIAL_HANDLE_PATTERN.test(value) ? null : 'social_invalid';
  }
  if (isWalletField(field)) {
    return WALLET_PATTERNS[field].some((pattern) => pattern.test(value)) ? null : 'wallet_invalid';
  }
  if (field === 'email') {
    return EMAIL_PATTERN.test(value) ? null : 'email_invalid';
  }
  if (field === 'website') {
    return isHttpUrl(value) ? null : 'url_invalid';
  }
  if (field === 'profile_image' || field === 'cover_image') {
    return isAbsoluteHttpUrl(value) ? null : 'url_invalid';
  }
  return null;
}

/**
 * Changed fields only: an unchanged legacy value that fails today's rules never blocks saving
 * other fields. An emptied field becomes `null` (removes the key on chain).
 */
export function buildProfilePatch(
  initial: ProfileFormValues,
  current: ProfileFormValues,
): HiveProfilePatch {
  const patch: HiveProfilePatch = {};
  for (const field of PROFILE_FORM_FIELDS) {
    const before = normalizeProfileValue(field, initial[field]);
    const after = normalizeProfileValue(field, current[field]);
    if (before === after) {
      continue;
    }
    patch[field] = after === '' ? null : after;
  }
  return patch;
}

/** Field errors for the values the user changed. */
export function validateProfileForm(
  initial: ProfileFormValues,
  current: ProfileFormValues,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};
  const patch = buildProfilePatch(initial, current);
  for (const field of PROFILE_FORM_FIELDS) {
    const next = patch[field];
    if (typeof next !== 'string') {
      continue;
    }
    const error = validateProfileValue(field, next);
    if (error) {
      errors[field] = error;
    }
  }
  return errors;
}

function profileFieldSchema(field: HiveProfileField) {
  return z
    .union([
      z.null(),
      z
        .string()
        .transform((raw) => normalizeProfileValue(field, raw))
        .superRefine((value, ctx) => {
          const error = validateProfileValue(field, value);
          if (error) {
            ctx.addIssue({ code: 'custom', message: error });
          }
        })
        .transform((value) => (value === '' ? null : value)),
    ])
    .optional();
}

const profilePatchShape = Object.fromEntries(
  PROFILE_FORM_FIELDS.map((field) => [field, profileFieldSchema(field)]),
) as Record<HiveProfileField, ReturnType<typeof profileFieldSchema>>;

/** Canonical payload of a profile save; the server action re-validates with it before broadcast. */
export const profilePatchSchema = z.strictObject(profilePatchShape);

export function parseProfilePatch(input: unknown): HiveProfilePatch | null {
  const parsed = profilePatchSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }
  const patch: HiveProfilePatch = {};
  for (const field of PROFILE_FORM_FIELDS) {
    const value = parsed.data[field];
    if (value !== undefined) {
      patch[field] = value;
    }
  }
  return patch;
}

export function profileFieldErrorMessageKey(code: ProfileFieldErrorCode): MessageKey {
  switch (code) {
    case 'too_long':
      return 'profile_value_too_long';
    case 'social_invalid':
      return 'profile_social_profile_incorrect';
    case 'whatsapp_invalid':
      return 'profile_whatsapp_invalid';
    case 'wallet_invalid':
      return 'profile_wallet_address_invalid';
    case 'email_invalid':
      return 'profile_email_invalid';
    case 'url_invalid':
      return 'profile_url_invalid';
  }
}
