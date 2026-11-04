import type { Kysely } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { createTestDb } from '@opden-data-layer/test-postgres';

import {
  insertInvoiceWithLine,
  insertLedger,
  insertPayment,
  insertWaivUsdRate,
  resetObl,
} from '../support/fixtures/obl';

type DirectionalUsd = { owesAtoB: string; owesBtoA: string; netUsd: string };
type PairBalance = { accountA: string; accountB: string; confirmed: DirectionalUsd };
type PaymentView = {
  payment_id: string;
  payer: string;
  receiver: string;
  paid_by: string | null;
};
type PaymentsPage = { items: PaymentView[]; hasMore: boolean; nextCursor: string | null };

const ZERO_USD = '0.00000000';

async function getObl<T>(
  path: string,
  query: Record<string, string>,
): Promise<{ status: number; body: T }> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${process.env['E2E_BASE_URL']}/query/v1/obl${path}?${qs}`);
  return { status: res.status, body: (await res.json()) as T };
}

describe('query-api OBL (e2e)', () => {
  let db: Kysely<OdlDatabase>;

  beforeAll(async () => {
    db = createTestDb();
    await resetObl(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('TC-201: payment on behalf', () => {
    const debtor = 'e2e-debtor';
    const receiver = 'e2e-receiver';
    const helper = 'e2e-helper';

    beforeAll(async () => {
      await insertInvoiceWithLine(db, {
        invoiceId: 'tc201-invoice',
        debtor,
        creditor: receiver,
        amountUsd: '100',
        seq: 10,
      });
      await insertPayment(db, {
        paymentId: 'tc201-payment',
        payer: debtor,
        receiver,
        amountUsd: '40',
        paidBy: helper,
        seq: 20,
      });
    });

    it('reduces the debtor → receiver debt', async () => {
      const { status, body } = await getObl<PairBalance>('/balance', {
        accountA: debtor,
        accountB: receiver,
      });

      expect(status).toBe(200);
      expect(body.confirmed.owesAtoB).toBe('60.00000000');
      expect(body.confirmed.owesBtoA).toBe(ZERO_USD);
    });

    it('keeps the account that actually paid in paid_by', async () => {
      const { status, body } = await getObl<{ payments: PaymentView[] }>('/ledger', {
        accountA: debtor,
        accountB: receiver,
      });

      expect(status).toBe(200);
      expect(body.payments).toHaveLength(1);
      expect(body.payments[0]).toMatchObject({
        payment_id: 'tc201-payment',
        payer: debtor,
        receiver,
        paid_by: helper,
      });
    });

    it('creates no ledger between the helper and the receiver', async () => {
      const payments = await getObl<PaymentsPage>('/ledger/payments', {
        accountA: helper,
        accountB: receiver,
      });
      const balance = await getObl<PairBalance>('/balance', {
        accountA: helper,
        accountB: receiver,
      });

      expect(payments.status).toBe(200);
      expect(payments.body.items).toEqual([]);
      expect(balance.body.confirmed).toEqual({
        owesAtoB: ZERO_USD,
        owesBtoA: ZERO_USD,
        netUsd: ZERO_USD,
      });
    });
  });

  describe('GET /obl/ledger/payments', () => {
    const accountA = 'e2e-page-a';
    const accountB = 'e2e-page-b';
    const startedEventSeq = 100;

    beforeAll(async () => {
      await insertLedger(db, accountA, accountB, startedEventSeq);
      for (const seq of [50, 110, 120, 130]) {
        await insertPayment(db, {
          paymentId: `page-${seq}`,
          payer: accountA,
          receiver: accountB,
          amountUsd: '1',
          seq,
        });
      }
    });

    it('drops payments before started_event_seq and pages with a cursor', async () => {
      const first = await getObl<PaymentsPage>('/ledger/payments', {
        accountA,
        accountB,
        limit: '2',
      });

      expect(first.status).toBe(200);
      expect(first.body.items.map((p) => p.payment_id)).toEqual(['page-130', 'page-120']);
      expect(first.body.hasMore).toBe(true);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await getObl<PaymentsPage>('/ledger/payments', {
        accountA,
        accountB,
        limit: '2',
        cursor: first.body.nextCursor ?? '',
      });

      expect(second.status).toBe(200);
      expect(second.body.items.map((p) => p.payment_id)).toEqual(['page-110']);
      expect(second.body.hasMore).toBe(false);
      expect(second.body.nextCursor).toBeNull();
    });
  });

  describe('GET /obl/balance', () => {
    it('rejects the same account on both sides with 400', async () => {
      const { status } = await getObl<unknown>('/balance', {
        accountA: 'e2e-same',
        accountB: 'E2E-Same ',
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /obl/convert/usd-to-waiv', () => {
    it('returns nulls when no WAIV rate is stored', async () => {
      const { status, body } = await getObl<Record<string, unknown>>('/convert/usd-to-waiv', {
        amountUsd: '10',
      });

      expect(status).toBe(200);
      expect(body).toEqual({ amountUsd: 10, rateUsd: null, amountWaiv: null });
    });

    it('converts with the latest stored WAIV rate', async () => {
      await insertWaivUsdRate(db, 0.5);

      const { status, body } = await getObl<Record<string, unknown>>('/convert/usd-to-waiv', {
        amountUsd: '10',
      });

      expect(status).toBe(200);
      expect(body).toEqual({ amountUsd: 10, rateUsd: 0.5, amountWaiv: 20 });
    });
  });
});
