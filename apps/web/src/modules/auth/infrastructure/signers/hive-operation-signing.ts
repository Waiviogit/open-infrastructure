import type { HiveOperation } from '@opden-data-layer/hive-broadcast';

const ACTIVE_KEY_OPERATION_TYPES = new Set([
  'transfer',
  'transfer_to_vesting',
  'withdraw_vesting',
  'delegate_vesting_shares',
  'transfer_to_savings',
  'transfer_from_savings',
  'cancel_transfer_from_savings',
  'account_update',
  'convert',
  'collateralized_convert',
  'limit_order_create',
  'limit_order_cancel',
]);

/**
 * Hive L1 ops and `custom_json` with `required_auths` need the active key.
 * `account_update2` that only replaces `posting_json_metadata` is signed with the posting key.
 */
export function hiveOperationRequiresActiveKey(op: HiveOperation): boolean {
  if (op.type === 'custom_json') {
    return op.required_auths.length > 0;
  }
  if (op.type === 'account_update2') {
    return op.json_metadata !== '';
  }
  return ACTIVE_KEY_OPERATION_TYPES.has(op.type);
}

export function hivePayloadRequiresActiveKey(
  operations: readonly HiveOperation[],
): boolean {
  return operations.some(hiveOperationRequiresActiveKey);
}

export type HiveKeychainBroadcastKey = 'Posting' | 'Active';

export function resolveKeychainBroadcastKey(
  operations: readonly HiveOperation[],
): HiveKeychainBroadcastKey {
  return hivePayloadRequiresActiveKey(operations) ? 'Active' : 'Posting';
}
