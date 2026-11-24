export type ChangellyJsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown> | Record<string, unknown>[];
};

export type ChangellyPairParams = {
  from: string;
  to: string;
  minAmountFloat: string;
  maxAmountFloat: string;
  minAmountFixed?: string;
  maxAmountFixed?: string;
};

export type ChangellyExchangeAmount = {
  from?: string;
  to?: string;
  amountFrom?: string;
  amountTo: string;
  rate?: string;
  /** Payout network fee in the payout coin; `amountTo` is before it is withheld. */
  networkFee?: string;
  min?: string;
  max?: string;
};

export type ChangellyTransactionResult = {
  id: string;
  payinAddress: string;
  payinExtraId: string;
  amountExpectedFrom: string;
  amountExpectedTo: string;
  trackUrl: string;
};

export type ChangellyPayinExchange = {
  memo: string;
  receiver: string;
  exchangeId: string;
  outputAmount: string;
  trackUrl: string;
};

/** Normalized exchange created by `createFloatTransaction` / `createFixTransaction`. */
export type ChangellyCreatedTransaction = {
  id: string;
  type: string | null;
  payinAddress: string;
  payinExtraId: string | null;
  payoutAddress: string | null;
  payoutExtraId: string | null;
  amountExpectedFrom: string | null;
  amountExpectedTo: string | null;
  networkFee: string | null;
  payTill: string | null;
  currencyFrom: string | null;
  currencyTo: string | null;
  /** Changelly timestamp in microseconds. */
  createdAt: number | null;
};

export type ChangellyCurrency = {
  ticker: string;
  fullName: string | null;
  enabled: boolean;
  enabledFrom: boolean;
  enabledTo: boolean;
  fixRateEnabled: boolean;
  payinConfirmations: number | null;
  extraIdName: string | null;
  blockchain: string | null;
  protocol: string | null;
  image: string | null;
  payinNotification: string | null;
};

export type ChangellyPair = {
  from: string;
  to: string;
};

export type ChangellyFixRate = {
  /** `rateId` for `createFixTransaction`; valid for about one minute. */
  id: string;
  from: string | null;
  to: string | null;
  /** Rate before the network fee. */
  result: string | null;
  networkFee: string | null;
  amountFrom: string | null;
  amountTo: string | null;
  min: string | null;
  max: string | null;
  /** Unix seconds. */
  expiredAt: number | null;
};

export type ChangellyTransactionInfo = {
  id: string;
  status: string;
  type: string | null;
  currencyFrom: string | null;
  currencyTo: string | null;
  payinAddress: string | null;
  payinExtraId: string | null;
  payinHash: string | null;
  payoutAddress: string | null;
  payoutExtraId: string | null;
  payoutHash: string | null;
  payoutHashLink: string | null;
  amountFrom: string | null;
  amountTo: string | null;
  amountExpectedFrom: string | null;
  amountExpectedTo: string | null;
  networkFee: string | null;
  payTill: string | null;
  /** Changelly timestamp in microseconds. */
  createdAt: number | null;
};

export type ChangellyTransactionsFilter = {
  id?: string[];
  status?: string[];
  currency?: string[];
  payoutAddress?: string[];
  limit?: number;
  offset?: number;
};

export type ChangellyAddressValidation = {
  result: boolean;
  message: string | null;
};
