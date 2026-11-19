import type { OfferSeoInput } from '../domain/metadata.types';
import { buildOfferMetadata } from './build-offer-metadata';

jest.mock('../infrastructure/seo-public-origin', () => ({
  seoPublicOrigin: () => 'https://site.com',
}));

const baseInput: OfferSeoInput = {
  kind: 'offer',
  offerId: 'offer-logo',
  version: 2,
  name: 'Logo design in three rounds',
  description: '**A polished logo** with [source files](https://x.example).',
  authorName: 'alice',
  kindLabel: 'Offer',
};

describe('buildOfferMetadata', () => {
  it('uses the offer name and a plain-text description', () => {
    const meta = buildOfferMetadata(baseInput);
    expect(meta.title).toBe('Logo design in three rounds');
    expect(meta.description).toBe('A polished logo with source files.');
    expect(meta.openGraph?.title).toBe('Logo design in three rounds');
  });

  it('points the canonical at the offer or request version page', () => {
    expect(buildOfferMetadata(baseInput).alternates?.canonical).toBe(
      'https://site.com/offers/offer-logo/versions/2',
    );
    expect(
      buildOfferMetadata({ ...baseInput, kind: 'request' }).alternates
        ?.canonical,
    ).toBe('https://site.com/requests/offer-logo/versions/2');
  });

  it('cuts long descriptions to a search snippet', () => {
    const meta = buildOfferMetadata({
      ...baseInput,
      description: 'word '.repeat(80),
    });
    const description = String(meta.description);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith('…')).toBe(true);
  });

  it('falls back to kind and author without a description', () => {
    const meta = buildOfferMetadata({ ...baseInput, description: null });
    expect(meta.description).toBe('Offer · @alice');
  });
});
