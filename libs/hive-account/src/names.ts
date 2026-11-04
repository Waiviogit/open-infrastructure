import { isHiveAccountName } from '@opden-data-layer/common';

export { isHiveAccountName };

const SUGGESTED_ACCOUNT_NAME_LENGTH = 8;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function suggestAccountName(): string {
  const entropy = new Uint8Array(SUGGESTED_ACCOUNT_NAME_LENGTH);
  crypto.getRandomValues(entropy);
  return Array.from(entropy, (byte) => LETTERS[byte % LETTERS.length]).join('');
}
