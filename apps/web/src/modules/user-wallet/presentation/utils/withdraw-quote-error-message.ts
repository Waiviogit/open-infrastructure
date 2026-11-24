import type { EngineWithdrawQuoteApiResponse } from '../../application/dto/engine-swap-api.schema';
import type { Translate } from '@/i18n/types';

export function withdrawQuoteErrorMessage(
  t: Translate,
  quote: Pick<
    EngineWithdrawQuoteApiResponse,
    'error' | 'errorCode' | 'errorParams'
  >,
): string | null {
  if (!quote.error && !quote.errorCode) {
    return null;
  }

  switch (quote.errorCode) {
    case 'eth_gas_fee':
      return t('wallet_withdraw_eth_gas_fee', {
        fee: quote.errorParams?.fee ?? '?',
      });
    case 'minimum_withdraw_amount':
      return t('wallet_withdraw_minimum_amount', {
        amount: quote.errorParams?.amount ?? '?',
        symbol: quote.errorParams?.symbol ?? '',
      });
    case 'minimum_receive_amount':
      return t('wallet_withdraw_minimum_receive', {
        amount: quote.errorParams?.amount ?? '?',
        symbol: quote.errorParams?.symbol ?? '',
      });
    default:
      return quote.error ?? t('wallet_withdraw_quote_failed');
  }
}

export function formatWithdrawMinimumHint(
  t: Translate,
  token: {
    outputSymbol: string;
    minimumSwapAmount: number | null;
    minimumReceiveAmount: number | null;
  },
): string | null {
  if (token.outputSymbol === 'ETH' && token.minimumSwapAmount !== null) {
    return t('wallet_withdraw_eth_minimum_swap', {
      amount: token.minimumSwapAmount,
    });
  }
  if (token.minimumReceiveAmount !== null) {
    return `${t('minimal_withdraw_amount')}: ${token.minimumReceiveAmount} ${token.outputSymbol}`;
  }
  if (token.minimumSwapAmount !== null) {
    return t('wallet_withdraw_minimum_amount', {
      amount: token.minimumSwapAmount,
      symbol: token.outputSymbol === 'HIVE' ? 'SWAP.HIVE' : token.outputSymbol,
    });
  }
  return null;
}
