import { isHiveAccountName, normalizeHiveAccountInput } from '@opden-data-layer/common';

export function isValidHiveAccountName(raw: string): boolean {
  return isHiveAccountName(normalizeHiveAccountInput(raw));
}

export function normalizeHiveAccountName(raw: string): string {
  return normalizeHiveAccountInput(raw);
}
