import type { HiveWireOperation } from './hive-operation-wire';

/** Profile keys read by Hive frontends from `posting_json_metadata.profile`. */
export const HIVE_PROFILE_FIELDS = [
  'name',
  'about',
  'location',
  'website',
  'profile_image',
  'cover_image',
] as const;

export type HiveProfileField = (typeof HIVE_PROFILE_FIELDS)[number];

/** `string` sets the field, `null` removes it, omitted keeps the current value. */
export type HiveProfilePatch = Partial<Record<HiveProfileField, string | null>>;

/** Profile layout version written by current Hive frontends. */
export const HIVE_PROFILE_METADATA_VERSION = 2;

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

type JsonRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function copySafeRecord(source: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(source)) {
    if (!FORBIDDEN_JSON_KEYS.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

/** Parse account metadata JSON; returns `{}` for empty, invalid, or non-object values. */
export function parseHiveAccountMetadata(raw: string | null | undefined): JsonRecord {
  if (!raw || !raw.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainRecord(parsed) ? copySafeRecord(parsed) : {};
  } catch {
    return {};
  }
}

function readProfile(metadata: JsonRecord): JsonRecord | null {
  const profile = metadata['profile'];
  return isPlainRecord(profile) ? copySafeRecord(profile) : null;
}

export type MergeHiveProfileMetadataInput = {
  /** Current `posting_json_metadata` (string from `get_accounts`). */
  readonly postingJsonMetadata: string;
  /** Current `json_metadata`; seeds the profile when `posting_json_metadata` has none. */
  readonly jsonMetadata: string;
  readonly patch: HiveProfilePatch;
};

export type MergeHiveProfileMetadataResult = {
  /** Serialized `posting_json_metadata` to broadcast. */
  readonly postingJsonMetadata: string;
  readonly previousProfile: JsonRecord;
  readonly profile: JsonRecord;
  readonly changedFields: HiveProfileField[];
};

/**
 * Apply a profile patch on top of the account's current metadata.
 * Keeps every other top-level key and every unknown profile key, because
 * `account_update2` replaces `posting_json_metadata` as a whole.
 */
export function mergeHiveProfileMetadata(
  input: MergeHiveProfileMetadataInput,
): MergeHiveProfileMetadataResult {
  const postingMetadata = parseHiveAccountMetadata(input.postingJsonMetadata);
  const previousProfile =
    readProfile(postingMetadata) ??
    readProfile(parseHiveAccountMetadata(input.jsonMetadata)) ??
    {};

  const profile: JsonRecord = { ...previousProfile };
  const changedFields: HiveProfileField[] = [];

  for (const field of HIVE_PROFILE_FIELDS) {
    const next = input.patch[field];
    if (next === undefined) {
      continue;
    }
    if (next === null) {
      if (field in profile) {
        delete profile[field];
        changedFields.push(field);
      }
      continue;
    }
    if (profile[field] !== next) {
      profile[field] = next;
      changedFields.push(field);
    }
  }

  if (profile['version'] === undefined) {
    profile['version'] = HIVE_PROFILE_METADATA_VERSION;
  }

  return {
    postingJsonMetadata: JSON.stringify({ ...postingMetadata, profile }),
    previousProfile,
    profile,
    changedFields,
  };
}

export type BuildAccountUpdate2ProfileOpInput = {
  readonly account: string;
  /** Full serialized `posting_json_metadata` (already merged with current state). */
  readonly postingJsonMetadata: string;
};

/**
 * `account_update2` that only replaces `posting_json_metadata` (posting key is enough).
 * Empty `json_metadata` leaves the active-key metadata untouched on chain.
 */
export function buildAccountUpdate2ProfileOp(
  input: BuildAccountUpdate2ProfileOpInput,
): HiveWireOperation {
  const account = input.account.trim().replace(/^@/, '').toLowerCase();
  if (!account) {
    throw new Error('account is required');
  }
  if (!input.postingJsonMetadata.trim()) {
    throw new Error('postingJsonMetadata must not be empty');
  }

  return [
    'account_update2',
    {
      account,
      json_metadata: '',
      posting_json_metadata: input.postingJsonMetadata,
      extensions: [],
    },
  ];
}
