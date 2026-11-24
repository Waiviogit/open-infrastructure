import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CHANGELLY_CLIENT_MODULE_OPTIONS,
  type ChangellyClientModuleOptions,
} from './changelly-client.options';
import type {
  ChangellyClientInterface,
  ChangellyClientResult,
} from './interface';
import {
  mapChangellyAddressValidation,
  mapChangellyCreatedTransaction,
  mapChangellyCurrency,
  mapChangellyFixRate,
  mapChangellyPair,
  mapChangellyRows,
  mapChangellyTransactionInfo,
} from './map-changelly-records';
import { mapChangellyTransactionResult } from './map-changelly-transaction';
import type {
  ChangellyAddressValidation,
  ChangellyCreatedTransaction,
  ChangellyCurrency,
  ChangellyExchangeAmount,
  ChangellyFixRate,
  ChangellyJsonRpcRequest,
  ChangellyPair,
  ChangellyPairParams,
  ChangellyPayinExchange,
  ChangellyTransactionInfo,
  ChangellyTransactionResult,
  ChangellyTransactionsFilter,
} from './type';

const DEFAULT_BASE_URL = 'https://api.changelly.com/v2';
const DEFAULT_TIMEOUT_MS = 12_000;
const INCOMPLETE_TRANSACTION_MESSAGE = 'Changelly returned an incomplete transaction';

type ChangellyCredentials = {
  privateKey: KeyObject;
  publicKey: Buffer;
};

function parseChangellyCredentials(
  privateKeyHex: string | undefined,
): ChangellyCredentials | null {
  const privateKeyString = privateKeyHex ?? '';
  if (!privateKeyString) {
    return null;
  }
  try {
    const privateKey = createPrivateKey({
      key: privateKeyString,
      format: 'der',
      type: 'pkcs8',
      encoding: 'hex',
    });
    const publicKey = createPublicKey(privateKey).export({
      type: 'pkcs1',
      format: 'der',
    });
    return { privateKey, publicKey: publicKey as Buffer };
  } catch {
    return null;
  }
}

/** Legacy `formRequest` from waivio-api changellyAPI. */
function formRequest(
  credentials: ChangellyCredentials,
  message: ChangellyJsonRpcRequest,
  url: string,
): { method: 'POST'; url: string; headers: Record<string, string>; body: string } {
  const signature = sign('sha256', Buffer.from(JSON.stringify(message)), {
    key: credentials.privateKey,
    type: 'pkcs8',
    format: 'der',
  });
  return {
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': createHash('sha256').update(credentials.publicKey).digest('base64'),
      'X-Api-Signature': signature.toString('base64'),
    },
    body: JSON.stringify(message),
  };
}

const RPC_REQUEST_ID = 'odl';

function rpcRequest(
  method: string,
  params: ChangellyJsonRpcRequest['params'],
): ChangellyJsonRpcRequest {
  return { jsonrpc: '2.0', id: RPC_REQUEST_ID, method, params };
}

/** Drops `undefined` keys so the signed body only carries the params that were set. */
function withoutUndefined(input: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

@Injectable()
export class ChangellyClient implements ChangellyClientInterface {
  private readonly logger = new Logger(ChangellyClient.name);
  private credentials: ChangellyCredentials | null | undefined;

  constructor(
    @Inject(CHANGELLY_CLIENT_MODULE_OPTIONS)
    private readonly options: ChangellyClientModuleOptions,
  ) {}

  private resolveCredentials(): ChangellyCredentials | null {
    if (this.credentials !== undefined) {
      return this.credentials;
    }
    this.credentials = parseChangellyCredentials(this.options.privateKeyHex);
    if (!this.credentials) {
      this.logger.warn('Changelly private key missing or invalid');
    }
    return this.credentials;
  }

  private baseUrl(): string {
    return (this.options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private timeoutMs(): number {
    return this.options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Legacy `fetchData`. */
  private async fetchData<T>(
    message: ChangellyJsonRpcRequest,
  ): Promise<ChangellyClientResult<T>> {
    const credentials = this.resolveCredentials();
    if (!credentials) {
      return { error: { message: 'Changelly unavailable' } };
    }

    const request = formRequest(credentials, message, this.baseUrl());
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = (await response.json()) as {
        result?: T;
        error?: { message?: string };
      };
      if (data.error) {
        this.logger.warn(data.error.message ?? 'Changelly error');
        return { error: { message: data.error.message ?? 'Changelly error' } };
      }
      return { result: data.result as T };
    } catch (error) {
      this.logger.error((error as Error).message);
      return { error: { message: 'Changelly unavailable' } };
    }
  }

  async getPairsParams(input: {
    from?: string;
    to: string;
  }): Promise<ChangellyClientResult<ChangellyPairParams>> {
    const from = input.from ?? 'hive';
    const to = input.to;
    const { result, error } = await this.fetchData<ChangellyPairParams[]>({
      jsonrpc: '2.0',
      id: 'test',
      method: 'getPairsParams',
      params: {
        from,
        to,
      },
    });
    if (error) {
      return { error };
    }
    const row = result?.[0];
    if (!row) {
      return { error: { message: 'Changelly pair not found' } };
    }
    return { result: row };
  }

  async getExchangeAmount(input: {
    from?: string;
    to: string;
    amountFrom: number;
  }): Promise<ChangellyClientResult<ChangellyExchangeAmount>> {
    const from = input.from ?? 'hive';
    const to = input.to;
    const { result, error } = await this.fetchData<ChangellyExchangeAmount[]>({
      jsonrpc: '2.0',
      id: 'test',
      method: 'getExchangeAmount',
      params: {
        from,
        to,
        amountFrom: input.amountFrom,
      },
    });
    if (error) {
      return { error };
    }
    const row = result?.[0];
    if (!row) {
      return { error: { message: 'Changelly exchange amount unavailable' } };
    }
    return { result: row };
  }

  async createTransaction(input: {
    from?: string;
    to: string;
    amountFrom: number;
    address: string;
    refundAddress: string;
  }): Promise<ChangellyClientResult<ChangellyPayinExchange>> {
    const from = input.from ?? 'hive';
    const to = input.to;
    const { result, error } = await this.fetchData<ChangellyTransactionResult>({
      jsonrpc: '2.0',
      id: 'test',
      method: 'createTransaction',
      params: {
        from,
        to,
        amountFrom: input.amountFrom,
        address: input.address,
        refundAddress: input.refundAddress,
      },
    });
    if (error) {
      return { error };
    }
    if (!result) {
      return { error: { message: 'Changelly unavailable' } };
    }
    return { result: mapChangellyTransactionResult(result) };
  }

  async getCurrenciesFull(): Promise<ChangellyClientResult<ChangellyCurrency[]>> {
    const { result, error } = await this.fetchData<unknown>(
      rpcRequest('getCurrenciesFull', {}),
    );
    if (error) {
      return { error };
    }
    return { result: mapChangellyRows(result, mapChangellyCurrency) };
  }

  async getPairs(input: {
    from?: string;
    to?: string;
  }): Promise<ChangellyClientResult<ChangellyPair[]>> {
    const { result, error } = await this.fetchData<unknown>(
      rpcRequest('getPairs', withoutUndefined(input)),
    );
    if (error) {
      return { error };
    }
    return { result: mapChangellyRows(result, mapChangellyPair) };
  }

  /** `null` result: the amount is outside the fixed-rate limits (Changelly omits the pair). */
  async getFixRateForAmount(input: {
    from: string;
    to: string;
    amountFrom: number;
  }): Promise<ChangellyClientResult<ChangellyFixRate | null>> {
    const { result, error } = await this.fetchData<unknown>(
      rpcRequest('getFixRateForAmount', [
        { from: input.from, to: input.to, amountFrom: String(input.amountFrom) },
      ]),
    );
    if (error) {
      return { error };
    }
    return { result: mapChangellyRows(result, mapChangellyFixRate)[0] ?? null };
  }

  async createFloatTransaction(input: {
    from: string;
    to: string;
    amountFrom: number;
    address: string;
    extraId?: string;
    refundAddress?: string;
    refundExtraId?: string;
  }): Promise<ChangellyClientResult<ChangellyCreatedTransaction>> {
    return this.createExchange(
      rpcRequest(
        'createTransaction',
        withoutUndefined({ ...input, amountFrom: String(input.amountFrom) }),
      ),
    );
  }

  async createFixTransaction(input: {
    from: string;
    to: string;
    rateId: string;
    amountFrom: number;
    address: string;
    extraId?: string;
    refundAddress: string;
    refundExtraId?: string;
  }): Promise<ChangellyClientResult<ChangellyCreatedTransaction>> {
    return this.createExchange(
      rpcRequest(
        'createFixTransaction',
        withoutUndefined({ ...input, amountFrom: String(input.amountFrom) }),
      ),
    );
  }

  async getTransactions(
    filter: ChangellyTransactionsFilter,
  ): Promise<ChangellyClientResult<ChangellyTransactionInfo[]>> {
    const { result, error } = await this.fetchData<unknown>(
      rpcRequest('getTransactions', withoutUndefined(filter)),
    );
    if (error) {
      return { error };
    }
    return { result: mapChangellyRows(result, mapChangellyTransactionInfo) };
  }

  async validateAddress(input: {
    currency: string;
    address: string;
    extraId?: string;
  }): Promise<ChangellyClientResult<ChangellyAddressValidation>> {
    const { result, error } = await this.fetchData<unknown>(
      rpcRequest('validateAddress', withoutUndefined(input)),
    );
    if (error) {
      return { error };
    }
    const validation = mapChangellyAddressValidation(result);
    if (!validation) {
      return { error: { message: 'Changelly returned an invalid address check' } };
    }
    return { result: validation };
  }

  private async createExchange(
    message: ChangellyJsonRpcRequest,
  ): Promise<ChangellyClientResult<ChangellyCreatedTransaction>> {
    const { result, error } = await this.fetchData<unknown>(message);
    if (error) {
      return { error };
    }
    const created = mapChangellyCreatedTransaction(result);
    if (!created) {
      this.logger.warn(INCOMPLETE_TRANSACTION_MESSAGE);
      return { error: { message: INCOMPLETE_TRANSACTION_MESSAGE } };
    }
    return { result: created };
  }
}

