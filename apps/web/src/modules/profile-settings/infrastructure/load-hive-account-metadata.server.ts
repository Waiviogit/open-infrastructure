import 'server-only';

import { mergeHiveProfileMetadata } from '@opden-data-layer/hive-broadcast';

import { hiveRpcRequest } from '@/shared/infrastructure/hive/hive-rpc.server';

type HiveAccountMetadataRpc = {
  name: string;
  json_metadata?: unknown;
  posting_json_metadata?: unknown;
};

export type HiveAccountMetadataSnapshot = {
  readonly postingJsonMetadata: string;
  readonly jsonMetadata: string;
};

function metadataString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Live account metadata from a Hive node; `null` when the account is missing or every node fails. */
export async function loadHiveAccountMetadata(
  account: string,
): Promise<HiveAccountMetadataSnapshot | null> {
  const accounts = await hiveRpcRequest<HiveAccountMetadataRpc[]>('condenser_api.get_accounts', [
    [account],
  ]);
  const row = accounts?.[0];
  if (!row) {
    return null;
  }
  return {
    postingJsonMetadata: metadataString(row.posting_json_metadata),
    jsonMetadata: metadataString(row.json_metadata),
  };
}

/** Current profile object with the same precedence the save uses (posting metadata, then `json_metadata`). */
export function currentProfileFromSnapshot(
  snapshot: HiveAccountMetadataSnapshot,
): Readonly<Record<string, unknown>> {
  return mergeHiveProfileMetadata({ ...snapshot, patch: {} }).previousProfile;
}
