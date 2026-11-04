import type { OblRepository } from '../../repositories/obl.repository';
import { OblOnBehalfPayerResolver } from './obl-on-behalf-payer.resolver';

const LEDGER_START = BigInt(100);

function createResolver(ledgers: Record<string, bigint>): OblOnBehalfPayerResolver {
  const repo = {
    findLedgerStartedSeq: jest.fn(async (low: string, high: string) => ledgers[`${low}|${high}`] ?? null),
  } as unknown as OblRepository;
  return new OblOnBehalfPayerResolver(repo);
}

describe('OblOnBehalfPayerResolver', () => {
  const aliceBob = { 'alice|bob': LEDGER_START };

  it('attributes a third-party payment to the debtor and records the actual payer', async () => {
    const resolver = createResolver(aliceBob);
    await expect(
      resolver.resolve({ actor: 'carol', onBehalfOf: 'alice', receiver: 'bob', eventSeq: BigInt(150) }),
    ).resolves.toEqual({ payer: 'alice', paidBy: 'carol' });
  });

  it('leaves paidBy empty when the debtor pays itself', async () => {
    const resolver = createResolver(aliceBob);
    await expect(
      resolver.resolve({ actor: 'alice', onBehalfOf: 'alice', receiver: 'bob', eventSeq: BigInt(150) }),
    ).resolves.toEqual({ payer: 'alice', paidBy: null });
  });

  it('rejects when there is no debtor↔receiver ledger even if actor↔receiver has one', async () => {
    const resolver = createResolver({ 'bob|carol': LEDGER_START });
    await expect(
      resolver.resolve({ actor: 'carol', onBehalfOf: 'alice', receiver: 'bob', eventSeq: BigInt(150) }),
    ).resolves.toBeNull();
  });

  it('rejects an event before the ledger start', async () => {
    const resolver = createResolver(aliceBob);
    await expect(
      resolver.resolve({ actor: 'carol', onBehalfOf: 'alice', receiver: 'bob', eventSeq: BigInt(99) }),
    ).resolves.toBeNull();
  });

  it('accepts an event exactly at the ledger start', async () => {
    const resolver = createResolver(aliceBob);
    await expect(
      resolver.resolve({ actor: 'carol', onBehalfOf: 'alice', receiver: 'bob', eventSeq: LEDGER_START }),
    ).resolves.toEqual({ payer: 'alice', paidBy: 'carol' });
  });

  it('rejects when the receiver acts as payer', async () => {
    const resolver = createResolver(aliceBob);
    await expect(
      resolver.resolve({ actor: 'bob', onBehalfOf: 'alice', receiver: 'bob', eventSeq: BigInt(150) }),
    ).resolves.toBeNull();
  });

  it('rejects when the debtor is the receiver', async () => {
    const resolver = createResolver({ 'bob|bob': LEDGER_START });
    await expect(
      resolver.resolve({ actor: 'carol', onBehalfOf: 'bob', receiver: 'bob', eventSeq: BigInt(150) }),
    ).resolves.toBeNull();
  });
});
