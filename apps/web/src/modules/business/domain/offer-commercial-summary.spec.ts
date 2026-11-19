import { parseOfferCommercialSummary } from './offer-commercial-summary';

describe('parseOfferCommercialSummary', () => {
  it('reads a fixed price with a billing cycle', () => {
    expect(
      parseOfferCommercialSummary({
        pricingModel: 'fixed',
        amountUsd: '1250.00',
        billingCycle: ' monthly ',
      }),
    ).toEqual({
      pricingModel: 'fixed',
      amountUsd: 1250,
      billingCycle: 'monthly',
    });
  });

  it('reads an hourly rate given as a number', () => {
    expect(
      parseOfferCommercialSummary({ pricingModel: 'hourly', amountUsd: 45 }),
    ).toEqual({
      pricingModel: 'hourly',
      amountUsd: 45,
      billingCycle: null,
    });
  });

  it('treats unknown models, zero and garbage amounts as a custom price', () => {
    expect(
      parseOfferCommercialSummary({ pricingModel: 'weird', amountUsd: '0' }),
    ).toEqual({
      pricingModel: 'custom',
      amountUsd: null,
      billingCycle: null,
    });
    expect(
      parseOfferCommercialSummary({ amountUsd: 'abc' }).amountUsd,
    ).toBeNull();
  });

  it('survives non-object terms', () => {
    expect(parseOfferCommercialSummary(null).pricingModel).toBe('custom');
    expect(parseOfferCommercialSummary(['x']).amountUsd).toBeNull();
  });
});
