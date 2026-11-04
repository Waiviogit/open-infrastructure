import {
  buildCreateReportOp,
  buildCreateServiceOrderOp,
  buildCancelServiceOrderOp,
  buildIssueInvoiceOp,
  buildIssueSplitInvoiceOp,
  buildDeclarePaymentOnBehalfOp,
  buildPayOnBehalfWaivTransferOp,
} from './build-obl-ops';

describe('buildIssueSplitInvoiceOp', () => {
  it('normalizes debtor and beneficiary accounts and emits beneficiaries payload', () => {
    const op = buildIssueSplitInvoiceOp({
      oblCustomJsonId: 'obl-mainnet',
      invoiceId: 'inv-1',
      issuer: 'organizer',
      debtor: '@Sponsor',
      contractId: 'c-1',
      beneficiaries: [
        { beneficiary: '@Winner', amountUsd: '50' },
        { beneficiary: 'referral', amountUsd: '5', role: ' referral_fee ' },
      ],
    });

    const payload = JSON.parse(op.json).events[0].payload as {
      debtor: string;
      beneficiaries: Array<{ beneficiary: string; amount_usd: string; role?: string }>;
      creditor?: string;
    };

    expect(payload.debtor).toBe('sponsor');
    expect(payload.creditor).toBeUndefined();
    expect(payload.beneficiaries).toEqual([
      { beneficiary: 'winner', amount_usd: '50.00000000' },
      { beneficiary: 'referral', amount_usd: '5.00000000', role: 'referral_fee' },
    ]);
    expect(op.required_posting_auths).toEqual(['organizer']);
  });

  it('rejects invalid beneficiary amount', () => {
    expect(() =>
      buildIssueSplitInvoiceOp({
        oblCustomJsonId: 'obl-mainnet',
        invoiceId: 'inv-1',
        issuer: 'organizer',
        debtor: 'sponsor',
        beneficiaries: [{ beneficiary: 'winner', amountUsd: '0' }],
      }),
    ).toThrow('invalid amount_usd');
  });
});

describe('buildCreateServiceOrderOp', () => {
  it('emits service_order_create with creator posting auth', () => {
    const op = buildCreateServiceOrderOp({
      oblCustomJsonId: 'obl-mainnet',
      serviceOrderId: 'so-1',
      contractId: 'c-1',
      creator: 'alice',
      details: { note: 'x' },
    });
    const envelope = JSON.parse(op.json).events[0];
    expect(envelope.action).toBe('service_order_create');
    expect(envelope.payload.service_order_id).toBe('so-1');
    expect(op.required_posting_auths).toEqual(['alice']);
  });
});

describe('buildCancelServiceOrderOp', () => {
  it('signs via posting auths and omits canceller from JSON', () => {
    const op = buildCancelServiceOrderOp({
      oblCustomJsonId: 'obl-mainnet',
      serviceOrderId: 'so-1',
      username: 'alice',
    });
    const envelope = JSON.parse(op.json).events[0] as {
      action: string;
      payload: Record<string, unknown>;
    };
    expect(envelope.action).toBe('service_order_cancel');
    expect(envelope.payload).toEqual({ service_order_id: 'so-1' });
    expect(envelope.payload).not.toHaveProperty('canceller');
    expect(op.required_posting_auths).toEqual(['alice']);
  });
});

describe('buildCreateReportOp', () => {
  it('emits report_create with author posting auth', () => {
    const op = buildCreateReportOp({
      oblCustomJsonId: 'obl-mainnet',
      reportId: 'r-1',
      author: 'bob',
      serviceOrderId: 'so-1',
    });
    const envelope = JSON.parse(op.json).events[0];
    expect(envelope.action).toBe('report_create');
    expect(envelope.payload.report_id).toBe('r-1');
    expect(op.required_posting_auths).toEqual(['bob']);
  });
});

describe('buildIssueInvoiceOp', () => {
  it('threads optional service order and report ids', () => {
    const op = buildIssueInvoiceOp({
      oblCustomJsonId: 'obl-mainnet',
      invoiceId: 'inv-1',
      issuer: 'alice',
      debtor: 'bob',
      creditor: 'alice',
      amountUsd: '10',
      serviceOrderId: 'so-1',
      reportId: 'r-1',
    });
    const payload = JSON.parse(op.json).events[0].payload as {
      service_order_id?: string;
      report_id?: string;
    };
    expect(payload.service_order_id).toBe('so-1');
    expect(payload.report_id).toBe('r-1');
  });
});

describe('pay on behalf ops', () => {
  it('declares an off-chain payment for the debtor signed by the actual payer', () => {
    const op = buildDeclarePaymentOnBehalfOp({
      oblCustomJsonId: 'obl-mainnet',
      paymentId: 'pay-1',
      payer: 'alice',
      receiver: 'bob',
      paidBy: 'carol',
      amountUsd: '40',
    });
    const payload = JSON.parse(op.json).events[0].payload as Record<string, unknown>;

    expect(payload).toMatchObject({ payer: 'alice', receiver: 'bob', amount_usd: '40.00000000' });
    expect(op.required_posting_auths).toEqual(['carol']);
  });

  it('transfers WAIV to the receiver with the on-behalf memo naming the debtor', () => {
    const op = buildPayOnBehalfWaivTransferOp({
      paidBy: 'carol',
      debtor: 'alice',
      receiver: 'bob',
      amountWaiv: 12.5,
    });
    const json = JSON.parse(op.json) as {
      contractAction: string;
      contractPayload: Record<string, string>;
    };

    expect(op.required_auths).toEqual(['carol']);
    expect(json.contractAction).toBe('transfer');
    expect(json.contractPayload).toEqual({
      to: 'bob',
      symbol: 'WAIV',
      quantity: '12.50000000',
      memo: 'obl:on-behalf:alice',
    });
  });

  it('rejects a non-positive WAIV amount', () => {
    expect(() =>
      buildPayOnBehalfWaivTransferOp({ paidBy: 'carol', debtor: 'alice', receiver: 'bob', amountWaiv: 0 }),
    ).toThrow('invalid WAIV amount');
  });
});
