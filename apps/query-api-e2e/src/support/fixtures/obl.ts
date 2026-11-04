import { sql, type Kysely } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';

/**
 * OBL fixtures for the query-api e2e suite. The server runs in another process, so rows are
 * committed (no `withRollback`); each spec resets the tables in `beforeAll`.
 */
const OBL_TABLES = [
  'obl_disputes',
  'obl_obligation_lines',
  'obl_payments',
  'obl_reports',
  'obl_service_orders',
  'obl_invoices',
  'obl_contracts',
  'obl_offer_drafts',
  'obl_offers',
  'obl_ledgers',
  'hive_engine_rates',
] as const;

const BASE_TIME_MS = Date.UTC(2026, 0, 1);
const MS_PER_SEQ = 1_000;

/** Deterministic `created_at` that grows with the event sequence. */
function createdAtForSeq(seq: number): Date {
  return new Date(BASE_TIME_MS + seq * MS_PER_SEQ);
}

export async function resetObl(db: Kysely<OdlDatabase>): Promise<void> {
  const tables = sql.join(OBL_TABLES.map((table) => sql.table(table)));
  await sql`TRUNCATE ${tables} CASCADE`.execute(db);
}

export async function insertLedger(
  db: Kysely<OdlDatabase>,
  accountA: string,
  accountB: string,
  startedEventSeq: number,
): Promise<void> {
  const [pairLow, pairHigh] = [accountA, accountB].sort();
  await db
    .insertInto('obl_ledgers')
    .values({
      pair_low: pairLow,
      pair_high: pairHigh,
      started_event_seq: BigInt(startedEventSeq),
    })
    .execute();
}

export type InvoiceWithLineFixture = {
  invoiceId: string;
  debtor: string;
  creditor: string;
  amountUsd: string;
  seq: number;
};

/** Single-line confirmed invoice: `debtor` owes `creditor` `amountUsd`. */
export async function insertInvoiceWithLine(
  db: Kysely<OdlDatabase>,
  fixture: InvoiceWithLineFixture,
): Promise<void> {
  const createdAt = createdAtForSeq(fixture.seq);
  const transactionId = `tx-${fixture.invoiceId}`;
  await db
    .insertInto('obl_invoices')
    .values({
      invoice_id: fixture.invoiceId,
      contract_id: null,
      service_order_id: null,
      report_id: null,
      issuer: fixture.creditor,
      debtor: fixture.debtor,
      kind: 'single',
      details: {},
      created_event_seq: BigInt(fixture.seq),
      transaction_id: transactionId,
      created_at: createdAt,
    })
    .execute();
  await db
    .insertInto('obl_obligation_lines')
    .values({
      line_id: `${fixture.invoiceId}:0`,
      invoice_id: fixture.invoiceId,
      debtor: fixture.debtor,
      beneficiary: fixture.creditor,
      amount_usd: fixture.amountUsd,
      final_amount_usd: null,
      state: 'confirmed',
      dispute_group: fixture.invoiceId,
      role: null,
      created_event_seq: BigInt(fixture.seq),
      transaction_id: transactionId,
      created_at: createdAt,
    })
    .execute();
}

export type PaymentFixture = {
  paymentId: string;
  payer: string;
  receiver: string;
  amountUsd: string;
  seq: number;
  /** Third party that paid on behalf of `payer` (the debtor). */
  paidBy?: string;
};

/** Confirmed WAIV token-transfer payment. */
export async function insertPayment(
  db: Kysely<OdlDatabase>,
  fixture: PaymentFixture,
): Promise<void> {
  await db
    .insertInto('obl_payments')
    .values({
      payment_id: fixture.paymentId,
      payer: fixture.payer,
      receiver: fixture.receiver,
      amount_usd: fixture.amountUsd,
      declared_amount_usd: fixture.amountUsd,
      method: 'token_transfer',
      token_symbol: 'WAIV',
      token_amount: fixture.amountUsd,
      rate_usd: '1',
      state: 'confirmed',
      ref: null,
      paid_by: fixture.paidBy ?? null,
      created_event_seq: BigInt(fixture.seq),
      transaction_id: `tx-${fixture.paymentId}`,
      created_at: createdAtForSeq(fixture.seq),
    })
    .execute();
}

/** Latest intraday WAIV rate, the source of `/obl/convert/usd-to-waiv`. */
export async function insertWaivUsdRate(
  db: Kysely<OdlDatabase>,
  rateUsd: number,
): Promise<void> {
  await db
    .insertInto('hive_engine_rates')
    .values({
      base: 'WAIV',
      is_daily: false,
      date: new Date(BASE_TIME_MS),
      rate_hive: rateUsd,
      rate_usd: rateUsd,
      change_24h_hive: null,
      change_24h_usd: null,
    })
    .execute();
}
