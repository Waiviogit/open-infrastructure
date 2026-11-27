import type { WaivSwap } from './waiv-token.types';

export const WAIV_SYMBOL = 'WAIV';

/** Decimal places kept before the wallet formatter truncates the rate. */
const RATE_DECIMALS = 8;

export type SwapSide = 'buy' | 'sell';

/** From the WAIV point of view: receiving WAIV is a buy, paying WAIV a sell. */
export function swapSide(swap: WaivSwap): SwapSide {
  return swap.symbolOut === WAIV_SYMBOL ? 'buy' : 'sell';
}

export type SwapRate = { rate: string; quote: string; base: string };

/**
 * Wallet history rate: received per paid (`4.182 WAIV per SWAP.HIVE`), as a plain decimal
 * string for the wallet quantity formatter. Null when a quantity is unusable.
 */
export function swapRate(swap: WaivSwap): SwapRate | null {
  const inQty = Number.parseFloat(swap.symbolInQuantity);
  const outQty = Number.parseFloat(swap.symbolOutQuantity);
  if (!(inQty > 0) || !(outQty > 0)) {
    return null;
  }
  return {
    rate: (outQty / inQty).toFixed(RATE_DECIMALS),
    quote: swap.symbolOut,
    base: swap.symbolIn,
  };
}
