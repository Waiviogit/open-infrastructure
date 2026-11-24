import type {
  ChangellyAddressValidation,
  ChangellyCreatedTransaction,
  ChangellyCurrency,
  ChangellyFixRate,
  ChangellyPair,
  ChangellyTransactionInfo,
} from './type';

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RawRecord;
}

/** Non-empty string, or a finite number as its decimal string. */
function readString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

export function mapChangellyCreatedTransaction(
  value: unknown,
): ChangellyCreatedTransaction | null {
  const raw = asRecord(value);
  const id = readString(raw?.['id']);
  const payinAddress = readString(raw?.['payinAddress']);
  if (!raw || !id || !payinAddress) {
    return null;
  }
  return {
    id,
    type: readString(raw['type']),
    payinAddress,
    payinExtraId: readString(raw['payinExtraId']),
    payoutAddress: readString(raw['payoutAddress']),
    payoutExtraId: readString(raw['payoutExtraId']),
    amountExpectedFrom: readString(raw['amountExpectedFrom']),
    amountExpectedTo: readString(raw['amountExpectedTo']),
    networkFee: readString(raw['networkFee']),
    payTill: readString(raw['payTill']),
    currencyFrom: readString(raw['currencyFrom']),
    currencyTo: readString(raw['currencyTo']),
    createdAt: readNumber(raw['createdAt']),
  };
}

export function mapChangellyCurrency(value: unknown): ChangellyCurrency | null {
  const raw = asRecord(value);
  const ticker = readString(raw?.['ticker']);
  if (!raw || !ticker) {
    return null;
  }
  const notifications = asRecord(raw['notifications']);
  return {
    ticker: ticker.toLowerCase(),
    fullName: readString(raw['fullName']),
    enabled: readBoolean(raw['enabled']),
    enabledFrom: readBoolean(raw['enabledFrom']),
    enabledTo: readBoolean(raw['enabledTo']),
    fixRateEnabled: readBoolean(raw['fixRateEnabled']),
    payinConfirmations: readNumber(raw['payinConfirmations']),
    extraIdName: readString(raw['extraIdName']),
    blockchain: readString(raw['blockchain']),
    protocol: readString(raw['protocol']),
    image: readString(raw['image']),
    payinNotification: readString(notifications?.['payin']),
  };
}

export function mapChangellyPair(value: unknown): ChangellyPair | null {
  const raw = asRecord(value);
  const from = readString(raw?.['from']);
  const to = readString(raw?.['to']);
  if (!from || !to) {
    return null;
  }
  return { from: from.toLowerCase(), to: to.toLowerCase() };
}

export function mapChangellyFixRate(value: unknown): ChangellyFixRate | null {
  const raw = asRecord(value);
  const id = readString(raw?.['id']);
  if (!raw || !id) {
    return null;
  }
  return {
    id,
    from: readString(raw['from']),
    to: readString(raw['to']),
    result: readString(raw['result']),
    networkFee: readString(raw['networkFee']),
    amountFrom: readString(raw['amountFrom']),
    amountTo: readString(raw['amountTo']),
    min: readString(raw['minFrom']) ?? readString(raw['min']),
    max: readString(raw['maxFrom']) ?? readString(raw['max']),
    expiredAt: readNumber(raw['expiredAt']),
  };
}

export function mapChangellyTransactionInfo(
  value: unknown,
): ChangellyTransactionInfo | null {
  const raw = asRecord(value);
  const id = readString(raw?.['id']);
  const status = readString(raw?.['status']);
  if (!raw || !id || !status) {
    return null;
  }
  return {
    id,
    status,
    type: readString(raw['type']),
    currencyFrom: readString(raw['currencyFrom']),
    currencyTo: readString(raw['currencyTo']),
    payinAddress: readString(raw['payinAddress']),
    payinExtraId: readString(raw['payinExtraId']),
    payinHash: readString(raw['payinHash']),
    payoutAddress: readString(raw['payoutAddress']),
    payoutExtraId: readString(raw['payoutExtraId']),
    payoutHash: readString(raw['payoutHash']),
    payoutHashLink: readString(raw['payoutHashLink']),
    amountFrom: readString(raw['amountFrom']),
    amountTo: readString(raw['amountTo']),
    amountExpectedFrom: readString(raw['amountExpectedFrom']),
    amountExpectedTo: readString(raw['amountExpectedTo']),
    networkFee: readString(raw['networkFee']),
    payTill: readString(raw['payTill']),
    createdAt: readNumber(raw['createdAt']),
  };
}

export function mapChangellyAddressValidation(
  value: unknown,
): ChangellyAddressValidation | null {
  const raw = asRecord(value);
  if (!raw || typeof raw['result'] !== 'boolean') {
    return null;
  }
  return { result: raw['result'], message: readString(raw['message']) };
}

/** Maps a JSON-RPC array result, dropping rows that do not have the required fields. */
export function mapChangellyRows<T>(
  value: unknown,
  mapRow: (row: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(mapRow).filter((row): row is T => row !== null);
}
