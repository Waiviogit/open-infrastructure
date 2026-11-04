/**
 * Example scenario: OBL payment on behalf of debtor (docs/spec/obl/payment-on-behalf.md).
 * Steps: seed → drive → probe → notifications. Ops are built with the same client builders the web uses.
 */
import {
  buildOblInvoiceIssueOp,
  buildOblPaymentConfirmOp,
  buildOblPaymentDeclareOp,
} from '@opden-data-layer/hive-broadcast';
import { buildOblOnBehalfMemo } from '@opden-data-layer/core';
import type { Harness, Scenario } from '../indexer-harness';

const OBL_ID = 'obl-mainnet';

async function dumpPayments(h: Harness, label: string): Promise<void> {
  const rows = await h.db
    .selectFrom('obl_payments')
    .select(['payment_id', 'payer', 'receiver', 'paid_by', 'amount_usd', 'state', 'method', 'ref'])
    .orderBy('created_event_seq')
    .execute();
  h.log(`${label}: obl_payments`, rows);
}

const scenario: Scenario = {
  /** Ledgers alice↔bob and bob↔carol from genesis; WAIV = 0.5 USD. */
  async seed(h) {
    await h.db
      .insertInto('obl_ledgers')
      .values([
        { pair_low: 'alice', pair_high: 'bob', started_event_seq: BigInt(1) },
        { pair_low: 'bob', pair_high: 'carol', started_event_seq: BigInt(1) },
      ])
      .execute();
    await h.db
      .insertInto('hive_engine_rates')
      .values({ base: 'WAIV', is_daily: false, date: new Date(), rate_hive: 1, rate_usd: 0.5, change_24h_hive: null, change_24h_usd: null })
      .execute();
    console.log('seeded ledgers + WAIV rate');
  },

  /** bob invoices alice $100; carol pays $40 off-chain (bob confirms) and 20 WAIV ($10) on behalf of alice. */
  async drive(h) {
    await h.hiveBlock([
      buildOblInvoiceIssueOp({ id: OBL_ID, invoiceId: 'inv-1', issuer: 'bob', debtor: 'alice', creditor: 'bob', amountUsd: '100' }),
    ]);
    await h.hiveBlock([
      buildOblPaymentDeclareOp({ id: OBL_ID, paymentId: 'pay-carol-1', payer: 'alice', receiver: 'bob', amountUsd: '40', required_posting_auths: ['carol'] }),
    ]);
    const confirmBlock = await h.hiveBlock([
      buildOblPaymentConfirmOp({ id: OBL_ID, paymentId: 'pay-recv-1', receiver: 'bob', amountUsd: '40', declarePaymentId: 'pay-carol-1' }),
    ]);
    await h.heBlock(confirmBlock + 1, [
      h.heTokenTransfer({ sender: 'carol', to: 'bob', symbol: 'WAIV', quantity: '20.00000000', memo: buildOblOnBehalfMemo('alice'), txId: 'he-onbehalf-1' }),
    ]);
    await dumpPayments(h, 'after happy path');
  },

  /** Replay, unknown debtor, plain memo, receiver self-declare, no-ledger declare, wrong-case prefix. */
  async probe(h) {
    const ref = await h.hiveBlock([]);
    await h.heBlock(ref, [
      h.heTokenTransfer({ sender: 'carol', to: 'bob', symbol: 'WAIV', quantity: '20.00000000', memo: buildOblOnBehalfMemo('alice'), txId: 'he-onbehalf-1' }),
      h.heTokenTransfer({ sender: 'carol', to: 'bob', symbol: 'WAIV', quantity: '2.00000000', memo: buildOblOnBehalfMemo('dave'), txId: 'he-dave' }),
      h.heTokenTransfer({ sender: 'carol', to: 'bob', symbol: 'WAIV', quantity: '4.00000000', memo: 'thanks', txId: 'he-plain' }),
      h.heTokenTransfer({ sender: 'carol', to: 'bob', symbol: 'WAIV', quantity: '6.00000000', memo: 'OBL:ON-BEHALF:alice', txId: 'he-upper' }),
    ]);
    await h.hiveBlock([
      buildOblPaymentDeclareOp({ id: OBL_ID, paymentId: 'pay-bob-self', payer: 'alice', receiver: 'bob', amountUsd: '5', required_posting_auths: ['bob'] }),
      buildOblPaymentDeclareOp({ id: OBL_ID, paymentId: 'pay-dave', payer: 'dave', receiver: 'bob', amountUsd: '5', required_posting_auths: ['carol'] }),
    ]);
    await dumpPayments(h, 'after probes');
    h.log('obl_ledgers', await h.db.selectFrom('obl_ledgers').selectAll().execute());
  },

  async notifications(h) {
    h.log('notification stream', await h.notifications());
  },
};

export default scenario;
