import type { OdlEventContext } from '../../odl-shared';
import type { OblRepository } from '../../../repositories/obl.repository';
import { PaymentDeclareHandler } from './payment-declare.handler';
import { mockOblNotifications } from '../obl-notification.service.spec-helpers';
import { OblOnBehalfPayerResolver } from '../obl-on-behalf-payer.resolver';

const LEDGER_START = BigInt(10);

function ctx(creator: string): OdlEventContext {
  return {
    action: 'payment_declare',
    creator,
    blockNum: 1,
    transactionIndex: 0,
    operationIndex: 0,
    odlEventIndex: 0,
    transactionId: 'tx-declare',
    timestamp: '2026-01-01T00:00:00.000Z',
    eventSeq: BigInt(60),
    eventIdIndexMap: new Map(),
  };
}

function createHandler(options: { ledgers: Record<string, bigint>; existing?: boolean }) {
  const insertPayment = jest.fn().mockResolvedValue(undefined);
  const oblNotifications = mockOblNotifications();
  const repo = {
    findPayment: jest
      .fn()
      .mockResolvedValue(options.existing ? { payment_id: 'pay-1' } : null),
    findLedgerStartedSeq: jest.fn(
      async (low: string, high: string) => options.ledgers[`${low}|${high}`] ?? null,
    ),
    insertPayment,
  } as unknown as OblRepository;
  const handler = new PaymentDeclareHandler(
    repo,
    oblNotifications.service,
    new OblOnBehalfPayerResolver(repo),
  );
  return { handler, insertPayment, emit: oblNotifications.emit };
}

const declarePayload = {
  payment_id: 'pay-1',
  payer: 'bob',
  receiver: 'alice',
  amount_usd: '10',
};

describe('PaymentDeclareHandler', () => {
  it('emits obl_payment_declare after insert with pending state', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
    });

    await handler.handle(declarePayload, ctx('bob'));

    expect(insertPayment).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'obl_payment_declare',
        actor: 'bob',
        payload: expect.objectContaining({
          paymentId: 'pay-1',
          payer: 'bob',
          receiver: 'alice',
          amountUsd: '10.00000000',
          state: 'pending',
        }),
      }),
    );
  });

  it('does not emit when payment already exists', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
      existing: true,
    });

    await handler.handle(declarePayload, ctx('bob'));

    expect(insertPayment).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('records a third-party declare for the debtor with paid_by', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
    });

    await handler.handle(
      { ...declarePayload, payer: 'alice', receiver: 'bob', amount_usd: '50' },
      ctx('carol'),
    );

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payer: 'alice',
        receiver: 'bob',
        paid_by: 'carol',
        amount_usd: '50.00000000',
        state: 'pending',
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'obl_payment_declare',
        actor: 'carol',
        payload: expect.objectContaining({ payer: 'alice', receiver: 'bob', paidBy: 'carol' }),
      }),
    );
  });

  it('records a debtor declare without paid_by', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
    });

    await handler.handle({ ...declarePayload, payer: 'alice', receiver: 'bob' }, ctx('alice'));

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ payer: 'alice', paid_by: null }),
    );
    const body = emit.mock.calls[0][1] as { actor: string; payload: Record<string, unknown> };
    expect(body.actor).toBe('alice');
    expect(body.payload).not.toHaveProperty('paidBy');
  });

  it('rejects a third-party declare without a debtor-receiver ledger', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'bob|carol': LEDGER_START },
    });

    await handler.handle({ ...declarePayload, payer: 'alice', receiver: 'bob' }, ctx('carol'));

    expect(insertPayment).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('rejects a declare signed by the receiver on behalf of the debtor', async () => {
    const { handler, insertPayment, emit } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
    });

    await handler.handle({ ...declarePayload, payer: 'alice', receiver: 'bob' }, ctx('bob'));

    expect(insertPayment).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('counts an overpayment on behalf of the debtor in full', async () => {
    const { handler, insertPayment } = createHandler({
      ledgers: { 'alice|bob': LEDGER_START },
    });

    await handler.handle(
      { ...declarePayload, payer: 'alice', receiver: 'bob', amount_usd: '1000' },
      ctx('carol'),
    );

    expect(insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount_usd: '1000.00000000' }),
    );
  });
});
