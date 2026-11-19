import { parseUsdAmount } from './usd-format';

export type OfferPricingModel = 'fixed' | 'hourly' | 'custom';

/** What a catalog card / offer header needs to show the price without the full terms. */
export type OfferCommercialSummary = {
  pricingModel: OfferPricingModel;
  /** Positive USD amount, or null when the offer has no usable price (custom / missing). */
  amountUsd: number | null;
  /** Free-text billing cycle as entered by the author (e.g. "monthly"), trimmed. */
  billingCycle: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePricingModel(value: unknown): OfferPricingModel {
  return value === 'fixed' || value === 'hourly' ? value : 'custom';
}

/**
 * Reads the price from on-chain offer `terms` (untrusted JSON). Never throws: unknown shapes
 * become a "custom" price so the card still renders.
 */
export function parseOfferCommercialSummary(
  terms: unknown,
): OfferCommercialSummary {
  if (!isRecord(terms)) {
    return { pricingModel: 'custom', amountUsd: null, billingCycle: null };
  }
  const amount = parseUsdAmount(
    typeof terms.amountUsd === 'number'
      ? terms.amountUsd
      : String(terms.amountUsd ?? ''),
  );
  const billingCycle =
    typeof terms.billingCycle === 'string' ? terms.billingCycle.trim() : '';
  return {
    pricingModel: parsePricingModel(terms.pricingModel),
    amountUsd: amount !== null && amount > 0 ? amount : null,
    billingCycle: billingCycle.length > 0 ? billingCycle : null,
  };
}
