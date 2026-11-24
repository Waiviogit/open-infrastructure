import type {
  ChangellyAddressValidation,
  ChangellyCreatedTransaction,
  ChangellyCurrency,
  ChangellyExchangeAmount,
  ChangellyFixRate,
  ChangellyPair,
  ChangellyPairParams,
  ChangellyPayinExchange,
  ChangellyTransactionInfo,
  ChangellyTransactionsFilter,
} from '../type';

export type ChangellyClientResult<T> =
  | { result: T; error?: undefined }
  | { result?: undefined; error: { message: string } };

export interface ChangellyClientInterface {
  getPairsParams(input: {
    from?: string;
    to: string;
  }): Promise<ChangellyClientResult<ChangellyPairParams>>;

  getExchangeAmount(input: {
    from?: string;
    to: string;
    amountFrom: number;
  }): Promise<ChangellyClientResult<ChangellyExchangeAmount>>;

  createTransaction(input: {
    from?: string;
    to: string;
    amountFrom: number;
    address: string;
    refundAddress: string;
  }): Promise<ChangellyClientResult<ChangellyPayinExchange>>;

  getCurrenciesFull(): Promise<ChangellyClientResult<ChangellyCurrency[]>>;

  getPairs(input: {
    from?: string;
    to?: string;
  }): Promise<ChangellyClientResult<ChangellyPair[]>>;

  getFixRateForAmount(input: {
    from: string;
    to: string;
    amountFrom: number;
  }): Promise<ChangellyClientResult<ChangellyFixRate | null>>;

  createFloatTransaction(input: {
    from: string;
    to: string;
    amountFrom: number;
    address: string;
    extraId?: string;
    refundAddress?: string;
    refundExtraId?: string;
  }): Promise<ChangellyClientResult<ChangellyCreatedTransaction>>;

  createFixTransaction(input: {
    from: string;
    to: string;
    rateId: string;
    amountFrom: number;
    address: string;
    extraId?: string;
    refundAddress: string;
    refundExtraId?: string;
  }): Promise<ChangellyClientResult<ChangellyCreatedTransaction>>;

  getTransactions(
    filter: ChangellyTransactionsFilter,
  ): Promise<ChangellyClientResult<ChangellyTransactionInfo[]>>;

  validateAddress(input: {
    currency: string;
    address: string;
    extraId?: string;
  }): Promise<ChangellyClientResult<ChangellyAddressValidation>>;
}
