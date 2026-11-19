'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';
import { CopyIcon, FileTextIcon, PackageIcon, CheckIcon } from '@/icons';
import { UserAvatar } from '@/shared/presentation';

import {
  buildConfirmPaymentOp,
  buildCreateReportOp,
  buildCreateServiceOrderOp,
  buildCancelServiceOrderOp,
  buildDeclarePaymentOp,
  buildIssueInvoiceOp,
  buildIssueSplitInvoiceOp,
  buildOpenDisputeOp,
  buildResolveDisputeOp,
} from '../../application/build-obl-ops';
import {
  canViewerResolveDispute,
  disputeAuthorityForInvoice,
  findInvoiceForDispute,
  truncateText,
} from '../../domain/dispute-resolution';
import {
  contractDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../domain/contract-label';
import type {
  LedgerContractRow,
  LedgerDisputeRow,
  LedgerInvoiceRow,
  LedgerPaymentRow,
  LedgerReportRow,
  LedgerServiceOrderRow,
  PairBalanceView,
} from '../../domain/ledger.types';
import {
  groupLedgerInvoiceRows,
  type InvoiceIssueSubmitPayload,
} from '../../domain/invoice-issue';
import { sortByCreatedAtDesc } from '../../domain/ledger-sort';
import {
  newOblDisputeId,
  newOblInvoiceId,
  newOblPaymentConfirmId,
  newOblPaymentDeclareId,
  newOblReportId,
  newOblServiceOrderId,
} from '../../domain/obl-ids';
import { buildPayOnBehalfHref } from '../../domain/pay-on-behalf';
import { businessRoutes } from '../../domain/routes';
import { canCreateServiceOrderOnContract } from '../../domain/service-order-create';
import {
  RELATIONSHIP_TABS,
  buildRelationshipTabHref,
  parseRelationshipTab,
  type RelationshipTab,
} from '../../domain/relationship-tab-url';
import type { OblCursorPage } from '../../domain/obl-pagination.types';
import type { OblContractApiRow } from '../../infrastructure/clients/obl-ledger.server';
import { BalanceCards } from './balance-cards';
import { BusinessCreateReportModal } from './relationship/business-create-report-modal';
import { BusinessCreateServiceOrderModal } from './relationship/business-create-service-order-modal';
import { BusinessConfirmPaymentModal } from './relationship/business-confirm-payment-modal';
import { BusinessDeclarePaymentModal } from './relationship/business-declare-payment-modal';
import { BusinessIssueInvoiceModal } from './relationship/business-issue-invoice-modal';
import { BusinessServiceOrderCard } from './relationship/business-service-order-card';
import { BusinessOpenDisputeModal } from './relationship/business-open-dispute-modal';
import { BusinessResolveDisputeModal } from './relationship/business-resolve-dispute-modal';
import {
  LedgerContractCard,
  LedgerDisputeCard,
  LedgerInvoiceCard,
  LedgerReportCard,
} from './relationship/ledger-cards';
import { RelationshipPaymentRow } from './relationship/relationship-payment-row';
import { StateBadge } from './state-badge';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { useOblLedgerTabLists } from '../hooks/use-obl-ledger-tab-lists';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessActionsMenu } from '../ui/business-actions-menu';
import { BusinessBreadcrumbs } from '../ui/business-breadcrumbs';
import { BusinessButton } from '../ui/business-button';
import { BusinessConfirmDialog } from '../ui/business-confirm-dialog';
import { BusinessSubTabs } from '../ui/business-sub-tabs';
import { BusinessEmptyState } from '../ui/business-states';
import { businessCardClass } from '../ui/classes';

const COPIED_RESET_MS = 2000;
const CONTRACT_DESCRIPTION_MAX = 300;
const TITLE_AVATAR_SIZE = 40;
const MENU_ICON_SIZE = 18;
const LOADING_ROWS = 3;

function castTabRows<T>(items: unknown[]): T[] {
  return items as T[];
}

function hasOpenDisputeForInvoice(
  disputes: readonly LedgerDisputeRow[],
  invoiceId: string,
): boolean {
  return disputes.some(
    (d) => d.invoice_id === invoiceId && d.status === 'open',
  );
}

function canDisputeInvoice(
  invoice: LedgerInvoiceRow,
  username: string,
  disputes: readonly LedgerDisputeRow[],
): boolean {
  if (invoice.state !== 'confirmed' && invoice.state !== 'pending') {
    return false;
  }
  if (username !== invoice.debtor && username !== invoice.creditor) {
    const beneficiary = invoice.beneficiary ?? invoice.creditor;
    if (username !== beneficiary) {
      return false;
    }
  }
  return !hasOpenDisputeForInvoice(disputes, invoice.invoice_id);
}

function contractLabel(
  contractId: string | null | undefined,
  contracts: readonly LedgerContractRow[],
): string | null {
  if (!contractId) {
    return null;
  }
  const contract = contracts.find((c) => c.contract_id === contractId);
  return contract ? contractDisplayLabel(contract) : null;
}

function TabLoading() {
  return (
    <div className="flex flex-col gap-card-padding" aria-busy="true">
      {Array.from({ length: LOADING_ROWS }, (_, i) => (
        <div
          key={i}
          className={businessCardClass({ className: 'flex flex-col gap-2' })}
        >
          <div className="h-4 w-1/2 animate-pulse rounded-btn bg-surface-control" />
          <div className="h-3 w-1/3 animate-pulse rounded-btn bg-surface-control" />
        </div>
      ))}
    </div>
  );
}

function TabList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-card-padding">{children}</div>;
}

export function BusinessRelationshipDetailClient({
  username,
  counterparty,
  balance,
  initialTab,
  initialTabPages,
  contractLabels,
}: {
  username: string;
  counterparty: string;
  balance: PairBalanceView;
  initialTab: RelationshipTab;
  initialTabPages: Partial<Record<RelationshipTab, OblCursorPage<unknown>>>;
  contractLabels: OblContractApiRow[];
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const oblCustomJsonId = useOblCustomJsonId();
  const { broadcast, isBusy, phase, error, setError } = useOblBroadcast(
    username,
    counterparty,
  );
  const [tab, setTab] = useState<RelationshipTab>(initialTab);
  useEffect(() => {
    setTab(parseRelationshipTab(searchParams));
  }, [searchParams]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [serviceOrderModalOpen, setServiceOrderModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [payLinkCopied, setPayLinkCopied] = useState(false);
  const [confirmPaymentRow, setConfirmPaymentRow] =
    useState<LedgerPaymentRow | null>(null);
  const [disputeInvoice, setDisputeInvoice] = useState<LedgerInvoiceRow | null>(
    null,
  );
  const [resolveDisputeRow, setResolveDisputeRow] =
    useState<LedgerDisputeRow | null>(null);
  const [cancelServiceOrderId, setCancelServiceOrderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!payLinkCopied) {
      return;
    }
    const timer = window.setTimeout(
      () => setPayLinkCopied(false),
      COPIED_RESET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [payLinkCopied]);

  /** Every action dialog starts without the previous action's error. */
  function openAction(open: () => void) {
    setError(null);
    open();
  }

  const { lists, activeTabLoading, sentinelRef } = useOblLedgerTabLists({
    accountA: username,
    accountB: counterparty,
    activeTab: tab,
    initialPages: initialTabPages,
  });

  const contracts = useMemo(() => {
    const fromTab = sortByCreatedAtDesc(
      castTabRows<LedgerContractRow>(lists.contracts.items),
    );
    if (fromTab.length > 0) {
      return fromTab;
    }
    return sortByCreatedAtDesc(contractLabels as LedgerContractRow[]);
  }, [contractLabels, lists.contracts.items]);

  const serviceOrderContracts = useMemo(
    () => contracts.filter(canCreateServiceOrderOnContract),
    [contracts],
  );

  const invoices = useMemo(
    () =>
      groupLedgerInvoiceRows(
        sortByCreatedAtDesc(
          castTabRows<LedgerInvoiceRow>(lists.invoices.items),
        ),
      ),
    [lists.invoices.items],
  );
  const payments = useMemo(
    () =>
      sortByCreatedAtDesc(castTabRows<LedgerPaymentRow>(lists.payments.items)),
    [lists.payments.items],
  );
  const disputes = useMemo(
    () =>
      sortByCreatedAtDesc(castTabRows<LedgerDisputeRow>(lists.disputes.items)),
    [lists.disputes.items],
  );
  const serviceOrders = useMemo(
    () =>
      sortByCreatedAtDesc(
        castTabRows<LedgerServiceOrderRow>(lists['service-orders'].items),
      ),
    [lists['service-orders'].items],
  );
  const reports = useMemo(
    () =>
      sortByCreatedAtDesc(castTabRows<LedgerReportRow>(lists.reports.items)),
    [lists.reports.items],
  );

  const resolveAuthority = useMemo(() => {
    if (!resolveDisputeRow) {
      return null;
    }
    const invoice = findInvoiceForDispute(resolveDisputeRow, invoices);
    if (!invoice) {
      return null;
    }
    const governingContract = invoice.contract_id
      ? contracts.find((c) => c.contract_id === invoice.contract_id)
      : undefined;
    return disputeAuthorityForInvoice(invoice, contracts, governingContract);
  }, [resolveDisputeRow, invoices, contracts]);

  const resolveInvoice = useMemo(() => {
    if (!resolveDisputeRow) {
      return null;
    }
    return findInvoiceForDispute(resolveDisputeRow, invoices) ?? null;
  }, [resolveDisputeRow, invoices]);

  async function issueInvoice(
    payload: InvoiceIssueSubmitPayload,
  ): Promise<boolean> {
    const invoiceId = newOblInvoiceId();
    const revalidateOverride = {
      invoiceId,
      contractId: payload.contractId,
      serviceOrderId: payload.serviceOrderId,
      reportId: payload.reportId,
    };
    if (payload.mode === 'simple') {
      const txId = await broadcast(
        [
          buildIssueInvoiceOp({
            oblCustomJsonId,
            invoiceId,
            issuer: username,
            debtor: payload.parties.debtor,
            creditor: payload.parties.creditor,
            amountUsd: payload.amountUsd,
            contractId: payload.contractId,
            serviceOrderId: payload.serviceOrderId,
            reportId: payload.reportId,
            details: payload.details,
          }),
        ],
        revalidateOverride,
      );
      return txId !== null;
    }
    const txId = await broadcast(
      [
        buildIssueSplitInvoiceOp({
          oblCustomJsonId,
          invoiceId,
          issuer: username,
          debtor: payload.debtor,
          beneficiaries: payload.beneficiaries,
          contractId: payload.contractId,
          serviceOrderId: payload.serviceOrderId,
          reportId: payload.reportId,
          details: payload.details,
        }),
      ],
      revalidateOverride,
    );
    return txId !== null;
  }

  async function createServiceOrder(input: {
    contractId: string;
    details?: Record<string, unknown>;
  }): Promise<boolean> {
    const serviceOrderId = newOblServiceOrderId();
    const txId = await broadcast(
      [
        buildCreateServiceOrderOp({
          oblCustomJsonId,
          serviceOrderId,
          contractId: input.contractId,
          creator: username,
          details: input.details,
        }),
      ],
      { serviceOrderId, contractId: input.contractId },
    );
    return txId !== null;
  }

  async function cancelServiceOrder(serviceOrderId: string) {
    const txId = await broadcast(
      [
        buildCancelServiceOrderOp({
          oblCustomJsonId,
          serviceOrderId,
          username,
        }),
      ],
      { serviceOrderId },
    );
    if (txId !== null) {
      setCancelServiceOrderId(null);
    }
  }

  async function createReport(input: {
    contractId?: string;
    serviceOrderId?: string;
    details?: Record<string, unknown>;
  }): Promise<boolean> {
    const reportId = newOblReportId();
    const txId = await broadcast(
      [
        buildCreateReportOp({
          oblCustomJsonId,
          reportId,
          author: username,
          contractId: input.contractId,
          serviceOrderId: input.serviceOrderId,
          details: input.details,
        }),
      ],
      {
        reportId,
        contractId: input.contractId,
        serviceOrderId: input.serviceOrderId,
      },
    );
    return txId !== null;
  }

  async function copyPayOnBehalfLink() {
    const href = buildPayOnBehalfHref({
      debtor: username,
      receiver: counterparty,
    });
    try {
      await navigator.clipboard.writeText(
        new URL(href, window.location.origin).toString(),
      );
      setPayLinkCopied(true);
    } catch {
      setPayLinkCopied(false);
    }
  }

  async function recordPayment(
    amountUsd: string,
    parties: { payer: string; receiver: string },
    ref?: Record<string, unknown>,
  ): Promise<boolean> {
    if (parties.receiver === username) {
      const confirmTxId = await broadcast([
        buildConfirmPaymentOp({
          oblCustomJsonId,
          paymentId: newOblPaymentConfirmId(),
          receiver: username,
          payer: parties.payer,
          amountUsd,
          ref,
        }),
      ]);
      return confirmTxId !== null;
    }

    const txId = await broadcast([
      buildDeclarePaymentOp({
        oblCustomJsonId,
        paymentId: newOblPaymentDeclareId(),
        payer: parties.payer,
        receiver: parties.receiver,
        amountUsd,
        ref,
      }),
    ]);
    return txId !== null;
  }

  async function submitPaymentConfirm(
    pay: LedgerPaymentRow,
    amountUsd: string,
  ): Promise<boolean> {
    const txId = await broadcast([
      buildConfirmPaymentOp({
        oblCustomJsonId,
        paymentId: newOblPaymentConfirmId(),
        receiver: username,
        payer: pay.payer,
        amountUsd,
        declarePaymentId: pay.payment_id,
      }),
    ]);
    return txId !== null;
  }

  async function openDispute(
    invoice: LedgerInvoiceRow,
    proposedAmountUsd: string,
  ): Promise<boolean> {
    const txId = await broadcast([
      buildOpenDisputeOp({
        oblCustomJsonId,
        disputeId: newOblDisputeId(),
        invoiceId: invoice.invoice_id,
        disputant: username,
        proposedAmountUsd,
      }),
    ]);
    return txId !== null;
  }

  async function resolveDispute(
    dispute: LedgerDisputeRow,
    finalAmountUsd: string,
  ): Promise<boolean> {
    const txId = await broadcast([
      buildResolveDisputeOp({
        oblCustomJsonId,
        disputeId: dispute.dispute_id,
        resolver: username,
        finalAmountUsd,
      }),
    ]);
    return txId !== null;
  }

  const ledgerTabs = RELATIONSHIP_TABS.map((id) => ({
    id,
    href: buildRelationshipTabHref(counterparty, id),
    label: t(`business_tab_${id}`),
  }));

  const createInvoiceButton = (
    <BusinessButton
      variant="primary"
      size="sm"
      disabled={isBusy}
      onClick={() => openAction(() => setInvoiceModalOpen(true))}
    >
      {t('business_create_invoice')}
    </BusinessButton>
  );
  const recordPaymentButton = (
    <BusinessButton
      size="sm"
      disabled={isBusy}
      onClick={() => openAction(() => setDeclareModalOpen(true))}
    >
      {t('business_record_payment')}
    </BusinessButton>
  );

  function tabBody() {
    if (activeTabLoading) {
      return <TabLoading />;
    }

    if (tab === 'payments') {
      return payments.length === 0 ? (
        <BusinessEmptyState
          title={t('business_payments_empty')}
          description={t('business_payments_empty_body')}
          action={recordPaymentButton}
        />
      ) : (
        <TabList>
          {payments.map((pay) => (
            <RelationshipPaymentRow
              key={pay.payment_id}
              payment={pay}
              viewer={username}
              isBusy={isBusy}
              onConfirm={(row) => openAction(() => setConfirmPaymentRow(row))}
            />
          ))}
        </TabList>
      );
    }

    if (tab === 'contracts') {
      return contracts.length === 0 ? (
        <BusinessEmptyState
          title={t('business_contracts_empty')}
          description={t('business_contracts_empty_body')}
        />
      ) : (
        <TabList>
          {contracts.map((c) => (
            <LedgerContractCard
              key={c.contract_id}
              contract={c}
              label={contractDisplayLabel(c)}
              descriptionPreview={
                c.offer_description
                  ? truncateText(c.offer_description, CONTRACT_DESCRIPTION_MAX)
                  : null
              }
            />
          ))}
        </TabList>
      );
    }

    if (tab === 'service-orders') {
      return serviceOrders.length === 0 ? (
        <BusinessEmptyState
          title={t('business_service_orders_empty')}
          description={t('business_service_orders_empty_body')}
          action={
            serviceOrderContracts.length > 0 ? (
              <BusinessButton
                size="sm"
                disabled={isBusy}
                onClick={() => openAction(() => setServiceOrderModalOpen(true))}
              >
                {t('business_create_service_order')}
              </BusinessButton>
            ) : undefined
          }
        />
      ) : (
        <TabList>
          {serviceOrders.map((so) => (
            <BusinessServiceOrderCard
              key={so.service_order_id}
              so={so}
              username={username}
              title={serviceOrderDisplayLabel(so, contracts)}
              linkedContract={contractLabel(so.contract_id, contracts)}
              linkedContractUrl={businessRoutes.contract(so.contract_id)}
              isBusy={isBusy}
              onCancel={(serviceOrderId) =>
                openAction(() => setCancelServiceOrderId(serviceOrderId))
              }
            />
          ))}
        </TabList>
      );
    }

    if (tab === 'reports') {
      return reports.length === 0 ? (
        <BusinessEmptyState
          title={t('business_reports_empty')}
          description={t('business_reports_empty_body')}
          action={
            <BusinessButton
              size="sm"
              disabled={isBusy}
              onClick={() => openAction(() => setReportModalOpen(true))}
            >
              {t('business_create_report')}
            </BusinessButton>
          }
        />
      ) : (
        <TabList>
          {reports.map((rep) => {
            const linkedServiceOrder = rep.service_order_id
              ? serviceOrders.find(
                  (so) => so.service_order_id === rep.service_order_id,
                )
              : undefined;
            return (
              <LedgerReportCard
                key={rep.report_id}
                report={rep}
                contractLabel={contractLabel(rep.contract_id, contracts)}
                serviceOrderLabel={
                  linkedServiceOrder
                    ? serviceOrderDisplayLabel(linkedServiceOrder, contracts)
                    : rep.service_order_id
                }
              />
            );
          })}
        </TabList>
      );
    }

    if (tab === 'invoices') {
      return invoices.length === 0 ? (
        <BusinessEmptyState
          title={t('business_invoices_empty')}
          description={t('business_invoices_empty_body')}
          action={createInvoiceButton}
        />
      ) : (
        <TabList>
          {invoices.map((inv) => (
            <LedgerInvoiceCard
              key={inv.invoice_id}
              invoice={inv}
              contractLabel={contractLabel(inv.contract_id, contracts)}
              disputable={canDisputeInvoice(inv, username, disputes)}
              isBusy={isBusy}
              onDispute={() => openAction(() => setDisputeInvoice(inv))}
            />
          ))}
        </TabList>
      );
    }

    return disputes.length === 0 ? (
      <BusinessEmptyState
        title={t('business_disputes_empty')}
        description={t('business_disputes_empty_body')}
      />
    ) : (
      <TabList>
        {disputes.map((d) => {
          const linkedInvoice = findInvoiceForDispute(d, invoices);
          const governingContract = linkedInvoice?.contract_id
            ? contracts.find((c) => c.contract_id === linkedInvoice.contract_id)
            : undefined;
          return (
            <LedgerDisputeCard
              key={d.dispute_id}
              dispute={d}
              invoice={linkedInvoice}
              contractLabel={contractLabel(
                linkedInvoice?.contract_id,
                contracts,
              )}
              contractId={linkedInvoice?.contract_id ?? null}
              resolvable={canViewerResolveDispute(
                username,
                d,
                invoices,
                contracts,
                {
                  invoice: linkedInvoice,
                  governingContract,
                },
              )}
              isBusy={isBusy}
              onResolve={() => openAction(() => setResolveDisputeRow(d))}
            />
          );
        })}
      </TabList>
    );
  }

  return (
    <>
      <BusinessPageShell
        variant="entity"
        title={`@${counterparty}`}
        titleLeading={
          <UserAvatar username={counterparty} size={TITLE_AVATAR_SIZE} />
        }
        subtitle={t('business_relationship_detail_subtitle')}
        breadcrumbs={
          <BusinessBreadcrumbs
            items={[
              {
                label: t('business_nav_relationships'),
                href: businessRoutes.relationships,
              },
              { label: `@${counterparty}` },
            ]}
          />
        }
        actions={
          <>
            {createInvoiceButton}
            {recordPaymentButton}
            <BusinessActionsMenu
              label={t('business_more_actions')}
              actions={[
                {
                  id: 'service-order',
                  label: t('business_create_service_order'),
                  icon: <PackageIcon size={MENU_ICON_SIZE} />,
                  disabled: isBusy,
                  onSelect: () =>
                    openAction(() => setServiceOrderModalOpen(true)),
                },
                {
                  id: 'report',
                  label: t('business_create_report'),
                  icon: <FileTextIcon size={MENU_ICON_SIZE} />,
                  disabled: isBusy,
                  onSelect: () => openAction(() => setReportModalOpen(true)),
                },
                {
                  id: 'pay-link',
                  label: payLinkCopied
                    ? t('business_pay_on_behalf_link_copied')
                    : t('business_pay_on_behalf_copy_link'),
                  icon: payLinkCopied ? (
                    <CheckIcon size={MENU_ICON_SIZE} />
                  ) : (
                    <CopyIcon size={MENU_ICON_SIZE} />
                  ),
                  onSelect: () => void copyPayOnBehalfLink(),
                },
              ]}
            />
          </>
        }
      >
        <BalanceCards
          viewer={username}
          counterparty={counterparty}
          balance={balance}
        />
        {phase === 'indexing' ? (
          <div className="mt-3">
            <StateBadge variant="indexing" />
          </div>
        ) : null}
        {payLinkCopied ? (
          <p className="mt-3 text-body-sm text-fg" role="status">
            {t('business_pay_on_behalf_link_copied')}
          </p>
        ) : null}

        <BusinessSubTabs
          items={ledgerTabs}
          activeId={tab}
          method="replace"
          ariaLabel={t('business_ledger_tabs_aria')}
          className="mb-card-padding mt-section-y-sm"
        />

        {tabBody()}
        <div ref={sentinelRef} className="h-4" aria-hidden />
      </BusinessPageShell>

      <BusinessIssueInvoiceModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        isBusy={isBusy}
        issuer={username}
        counterparty={counterparty}
        debtor={counterparty}
        creditor={username}
        contracts={contracts}
        serviceOrders={serviceOrders}
        reports={reports}
        error={error}
        onSubmit={issueInvoice}
      />
      <BusinessCreateServiceOrderModal
        open={serviceOrderModalOpen}
        onClose={() => setServiceOrderModalOpen(false)}
        isBusy={isBusy}
        contracts={serviceOrderContracts}
        error={error}
        onSubmit={createServiceOrder}
      />
      <BusinessCreateReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        isBusy={isBusy}
        contracts={contracts}
        serviceOrders={serviceOrders}
        error={error}
        onSubmit={createReport}
      />
      <BusinessDeclarePaymentModal
        open={declareModalOpen}
        onClose={() => setDeclareModalOpen(false)}
        isBusy={isBusy}
        viewer={username}
        payer={username}
        receiver={counterparty}
        error={error}
        onSubmit={recordPayment}
      />
      <BusinessConfirmPaymentModal
        open={confirmPaymentRow !== null}
        payment={confirmPaymentRow}
        onClose={() => setConfirmPaymentRow(null)}
        isBusy={isBusy}
        error={error}
        onSubmit={submitPaymentConfirm}
      />
      <BusinessOpenDisputeModal
        open={disputeInvoice !== null}
        invoice={disputeInvoice}
        onClose={() => setDisputeInvoice(null)}
        isBusy={isBusy}
        error={error}
        onSubmit={openDispute}
      />
      <BusinessResolveDisputeModal
        open={resolveDisputeRow !== null}
        dispute={resolveDisputeRow}
        invoice={resolveInvoice}
        authority={resolveAuthority}
        onClose={() => setResolveDisputeRow(null)}
        isBusy={isBusy}
        error={error}
        onSubmit={resolveDispute}
      />
      <BusinessConfirmDialog
        open={cancelServiceOrderId !== null}
        title={t('business_service_order_cancel_confirm_title')}
        description={t('business_service_order_cancel_confirm_body')}
        confirmLabel={t('business_cancel_service_order')}
        destructive
        busy={isBusy}
        error={error}
        onConfirm={() => {
          if (cancelServiceOrderId) {
            void cancelServiceOrder(cancelServiceOrderId);
          }
        }}
        onClose={() => setCancelServiceOrderId(null)}
      />
    </>
  );
}
