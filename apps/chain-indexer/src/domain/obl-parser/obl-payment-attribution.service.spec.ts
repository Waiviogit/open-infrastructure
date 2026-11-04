import type { OblRepository } from '../../repositories/obl.repository';
import { OblOnBehalfPayerResolver } from './obl-on-behalf-payer.resolver';
import { OblPaymentAttributionService } from './obl-payment-attribution.service';
import type { OblUsdRatesService } from './obl-usd-rates.service';

const QUOTE = { amountUsd: '12.00000000', rateUsd: '1.2' };

function setup(options: {
  ledgers?: Record<string, bigint>;
  existingPayment?: boolean;
  quote?: typeof QUOTE | null;
}) {
  const ledgers = options.ledgers ?? {};
  const insertPayment = jest.fn().mockResolvedValue(undefined);
  const tokenToUsd = jest
    .fn()
    .mockResolvedValue(options.quote === undefined ? QUOTE : options.quote);
  const repo = {
    findLedgerStartedSeq: jest.fn(
      async (low: string, high: string) => ledgers[`${low}|${high}`] ?? null,
    ),
    findPayment: jest
      .fn()
      .mockResolvedValue(options.existingPayment ? { payment_id: 'existing' } : null),
    insertPayment,
  } as unknown as OblRepository;
  const service = new OblPaymentAttributionService(
    repo,
    { tokenToUsd } as unknown as OblUsdRatesService,
    new OblOnBehalfPayerResolver(repo),
  );
  return { service, insertPayment, tokenToUsd };
}

const transfer = {
  payer: 'carol',
  receiver: 'bob',
  symbol: 'WAIV',
  quantity: 10,
  transactionId: 'he-tx',
  refHiveBlockNumber: 100,
  trxIndex: 0,
  logIndex: 0,
};

const LEDGER_FROM_GENESIS = BigInt(1);
const LEDGER_FAR_FUTURE = BigInt(1) << BigInt(60);

describe('OblPaymentAttributionService', () => {
  it('skips token transfer before ledger started', async () => {
    const { service, insertPayment, tokenToUsd } = setup({
      ledgers: { 'bob|carol': LEDGER_FAR_FUTURE },
    });

    await service.recordTokenTransfer(transfer);

    expect(insertPayment).not.toHaveBeenCalled();
    expect(tokenToUsd).not.toHaveBeenCalled();
  });

  it('deduplicates by payment_id', async () => {
    const { service, insertPayment } = setup({
      ledgers: { 'alice|bob': LEDGER_FROM_GENESIS },
      existingPayment: true,
    });

    await service.recordTokenTransfer({ ...transfer, memo: 'obl:on-behalf:alice' });

    expect(insertPayment).not.toHaveBeenCalled();
  });

  it('counts a transfer with an on-behalf memo on the debtor-receiver ledger', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'alice|bob': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({ ...transfer, memo: 'obl:on-behalf:alice' });

    expect(insertPayment).toHaveBeenCalledTimes(1);
    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_id: 'obl:he-transfer:he-tx:0',
        payer: 'alice',
        receiver: 'bob',
        paid_by: 'carol',
        state: 'confirmed',
        method: 'token_transfer',
        amount_usd: QUOTE.amountUsd,
        ref: { he_tx: 'he-tx', on_behalf_of: 'alice' },
      }),
    );
  });

  it('skips an on-behalf transfer without a debtor-receiver ledger instead of using the sender pair', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'bob|carol': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({ ...transfer, memo: 'obl:on-behalf:alice' });

    expect(insertPayment).not.toHaveBeenCalled();
  });

  it('keeps the sender-receiver attribution when there is no memo', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'bob|carol': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({ ...transfer, memo: '' });

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payer: 'carol',
        receiver: 'bob',
        paid_by: null,
        ref: { he_tx: 'he-tx' },
      }),
    );
  });

  it('treats an on-behalf memo naming the sender as a regular payment', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'alice|bob': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({
      ...transfer,
      payer: 'alice',
      memo: 'obl:on-behalf:alice',
    });

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ payer: 'alice', receiver: 'bob', paid_by: null }),
    );
  });

  it('skips an on-behalf memo that names the receiver as debtor', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'bob|carol': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({ ...transfer, memo: 'obl:on-behalf:bob' });

    expect(insertPayment).not.toHaveBeenCalled();
  });

  it('ignores untracked tokens even with an on-behalf memo', async () => {
    const { service, insertPayment } = setup({ ledgers: { 'alice|bob': LEDGER_FROM_GENESIS } });

    await service.recordTokenTransfer({ ...transfer, symbol: 'BEE', memo: 'obl:on-behalf:alice' });

    expect(insertPayment).not.toHaveBeenCalled();
  });

  it('does not insert an on-behalf transfer when the USD rate is unavailable', async () => {
    const { service, insertPayment } = setup({
      ledgers: { 'alice|bob': LEDGER_FROM_GENESIS },
      quote: null,
    });

    await service.recordTokenTransfer({ ...transfer, memo: 'obl:on-behalf:alice' });

    expect(insertPayment).not.toHaveBeenCalled();
  });
});
