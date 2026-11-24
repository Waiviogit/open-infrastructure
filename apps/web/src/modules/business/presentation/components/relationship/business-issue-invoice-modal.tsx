'use client';

import { useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { UserRefSearchField } from '@/modules/object-updates/presentation/components/user-ref-search-field';

import type { InvoiceIssueSubmitPayload } from '../../../domain/invoice-issue';
import {
  allowedDebtorAccounts,
  isAttestorIssue,
  issuerInBeneficiaries,
  normalizeHiveAccountInput,
  predictSplitLineStates,
  requiresGoverningContract,
  sumBeneficiaryAmounts,
  validateSimpleIssue,
  validateSplitIssue,
  type BeneficiaryLineDraft,
  type InvoiceIssueMode,
} from '../../../domain/invoice-issue';
import type {
  LedgerContractRow,
  LedgerReportRow,
  LedgerServiceOrderRow,
} from '../../../domain/ledger.types';
import {
  contractDisplayLabel,
  reportDisplayLabel,
  serviceOrderDisplayLabel,
} from '../../../domain/contract-label';
import { formatUsd } from '../../../domain/usd-format';
import {
  BUSINESS_CALLOUT_CLASS,
  BUSINESS_FIELD_CLASS,
  BUSINESS_FOCUS_RING,
} from '../../ui/classes';
import { BusinessButton } from '../../ui/business-button';
import { BusinessField } from '../../ui/business-field';
import { BusinessFormModal } from '../../ui/business-form-modal';
import { ObjectBuilder } from '../object-builder';
import { StateBadge } from '../state-badge';
import {
  AccountPairSwapRow,
  RelationshipReadonlyField,
  parsePositiveUsdAmount,
} from './relationship-modal-fields';

export type BusinessIssueInvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  isBusy: boolean;
  error?: string | null;
  issuer: string;
  counterparty: string;
  debtor: string;
  creditor: string;
  contracts: LedgerContractRow[];
  serviceOrders: LedgerServiceOrderRow[];
  reports: LedgerReportRow[];
  /** Resolves `true` when the broadcast succeeded. */
  onSubmit: (payload: InvoiceIssueSubmitPayload) => Promise<boolean>;
};

type ModalStep = 'form' | 'confirm';

function emptyBeneficiaryLine(): BeneficiaryLineDraft {
  return { beneficiary: '', amountUsd: '', role: '' };
}

export function BusinessIssueInvoiceModal({
  open,
  onClose,
  isBusy,
  error,
  issuer,
  counterparty,
  debtor,
  creditor,
  contracts,
  serviceOrders,
  reports,
  onSubmit,
}: BusinessIssueInvoiceModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<ModalStep>('form');
  const [ack, setAck] = useState(false);
  const [mode, setMode] = useState<InvoiceIssueMode>('simple');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const [detailsValid, setDetailsValid] = useState(true);
  const [detailsBuilderKey, setDetailsBuilderKey] = useState(0);
  const [contractId, setContractId] = useState('');
  const [serviceOrderId, setServiceOrderId] = useState('');
  const [reportId, setReportId] = useState('');
  const [parties, setParties] = useState({ debtor, creditor });
  const [splitDebtor, setSplitDebtor] = useState(debtor);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryLineDraft[]>([
    emptyBeneficiaryLine(),
  ]);

  useEffect(() => {
    if (open) {
      setStep('form');
      setAck(false);
      setMode('simple');
      setAmount('');
      setParties({ debtor, creditor });
      setSplitDebtor(debtor);
      setContractId(contracts[0]?.contract_id ?? '');
      setServiceOrderId('');
      setReportId('');
      setBeneficiaries([emptyBeneficiaryLine()]);
      setDetails({});
      setDetailsValid(true);
      setDetailsBuilderKey((key) => key + 1);
    }
  }, [open, debtor, creditor, contracts]);

  const allowedDebtors = useMemo(
    () => allowedDebtorAccounts(issuer, contracts),
    [issuer, contracts],
  );

  useEffect(() => {
    if (mode !== 'split' || !contractId) {
      return;
    }
    const contract = contracts.find((c) => c.contract_id === contractId);
    if (!contract) {
      return;
    }
    const contractParties = [
      normalizeHiveAccountInput(contract.provider),
      normalizeHiveAccountInput(contract.client),
    ];
    const current = normalizeHiveAccountInput(splitDebtor);
    if (!contractParties.includes(current)) {
      const issuerNorm = normalizeHiveAccountInput(issuer);
      const fallback =
        contractParties.find((party) => party !== issuerNorm) ??
        contractParties[0];
      if (fallback) {
        setSplitDebtor(fallback);
      }
    }
  }, [contractId, contracts, issuer, mode, splitDebtor]);

  function beneficiaryExcludeForRow(index: number): string[] {
    const exclude: string[] = [];
    if (splitDebtor.trim().length > 0) {
      exclude.push(splitDebtor);
    }
    beneficiaries.forEach((line, i) => {
      if (i !== index && line.beneficiary.trim().length > 0) {
        exclude.push(line.beneficiary);
      }
    });
    return exclude;
  }

  function swapSplitDebtor() {
    const current = normalizeHiveAccountInput(splitDebtor);
    const issuerNorm = normalizeHiveAccountInput(issuer);
    const counterpartyNorm = normalizeHiveAccountInput(counterparty);
    const next =
      allowedDebtors.find((account) => account !== current) ??
      (current === issuerNorm ? counterpartyNorm : issuerNorm);
    setSplitDebtor(next);
  }

  const selfBeneficiary =
    mode === 'split' && issuerInBeneficiaries(issuer, beneficiaries);
  const attestor =
    mode === 'split' && isAttestorIssue(issuer, splitDebtor, beneficiaries);
  const contractRequired =
    mode === 'split' &&
    requiresGoverningContract(issuer, splitDebtor, beneficiaries);
  const splitTotal = sumBeneficiaryAmounts(beneficiaries);
  const predictedLines = useMemo(
    () =>
      mode === 'split'
        ? predictSplitLineStates({
            issuer,
            debtor: splitDebtor,
            beneficiaries,
            contracts,
          })
        : [],
    [beneficiaries, contracts, issuer, mode, splitDebtor],
  );

  const canSubmitSimple =
    mode === 'simple' &&
    detailsValid &&
    validateSimpleIssue({
      viewer: issuer,
      counterparty,
      debtor: parties.debtor,
      creditor: parties.creditor,
      amountUsd: amount,
    });

  const canSubmitSplit =
    mode === 'split' &&
    detailsValid &&
    validateSplitIssue({
      issuer,
      debtor: splitDebtor,
      beneficiaries,
      contracts,
      contractId: contractId || undefined,
    });

  const canSubmit = mode === 'simple' ? canSubmitSimple : canSubmitSplit;

  /** Only active service orders, narrowed to the chosen contract. */
  const linkableServiceOrders = useMemo(
    () =>
      serviceOrders.filter(
        (so) =>
          so.status !== 'cancelled' &&
          (!contractId || so.contract_id === contractId),
      ),
    [serviceOrders, contractId],
  );
  const linkableReports = useMemo(
    () =>
      reports.filter((rep) => !contractId || rep.contract_id === contractId),
    [reports, contractId],
  );

  async function handleSubmit(): Promise<boolean> {
    const detailsPayload =
      Object.keys(details).length > 0 ? details : undefined;

    if (mode === 'simple') {
      if (!parsePositiveUsdAmount(amount)) {
        return false;
      }
      return onSubmit({
        mode: 'simple',
        amountUsd: amount,
        parties,
        contractId: contractId || undefined,
        serviceOrderId: serviceOrderId.trim() || undefined,
        reportId: reportId.trim() || undefined,
        details: detailsPayload,
      });
    }
    return onSubmit({
      mode: 'split',
      debtor: normalizeHiveAccountInput(splitDebtor),
      beneficiaries: beneficiaries.map((line) => ({
        beneficiary: normalizeHiveAccountInput(line.beneficiary),
        amountUsd: line.amountUsd,
        role: line.role?.trim() || undefined,
      })),
      contractId: contractId || undefined,
      serviceOrderId: serviceOrderId.trim() || undefined,
      reportId: reportId.trim() || undefined,
      details: detailsPayload,
    });
  }

  /** Self-beneficiary splits pass through an explicit confirmation step first. */
  async function onPrimaryAction(): Promise<boolean> {
    if (step === 'form' && mode === 'split' && selfBeneficiary) {
      setStep('confirm');
      return false;
    }
    return handleSubmit();
  }

  function updateBeneficiary(
    index: number,
    patch: Partial<BeneficiaryLineDraft>,
  ) {
    setBeneficiaries((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  const modalTitle =
    step === 'confirm'
      ? t('business_invoice_split_confirm_title')
      : t('business_modal_issue_invoice_title');

  return (
    <BusinessFormModal
      open={open}
      onClose={onClose}
      title={modalTitle}
      busy={isBusy}
      error={error}
      submitLabel={
        step === 'confirm'
          ? t('business_invoice_split_confirm_broadcast')
          : t('business_create_invoice')
      }
      canSubmit={step === 'confirm' ? ack : canSubmit}
      onSubmit={onPrimaryAction}
      maxWidthClass="max-w-lg"
      footerStart={
        step === 'confirm' ? (
          <BusinessButton
            variant="ghost"
            disabled={isBusy}
            onClick={() => {
              setStep('form');
              setAck(false);
            }}
          >
            {t('business_invoice_split_confirm_back')}
          </BusinessButton>
        ) : null
      }
    >
      {step === 'confirm' ? (
        <>
          <p className="text-body-sm text-fg">
            {t('business_invoice_split_confirm_body')}
          </p>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b border-border bg-surface-control text-caption text-fg-secondary">
                  <th
                    scope="col"
                    className="px-3 py-2 text-start font-weight-label"
                  >
                    {t('business_invoice_split_confirm_row_beneficiary')}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-end font-weight-label"
                  >
                    {t('business_invoice_split_confirm_row_amount')}
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-start font-weight-label"
                  >
                    {t('business_invoice_split_confirm_row_status')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictedLines.map((line) => (
                  <tr
                    key={line.beneficiary}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="break-words px-3 py-2 [overflow-wrap:anywhere]">
                      @{line.beneficiary}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums">
                      {formatUsd(line.amountUsd)}
                    </td>
                    <td className="px-3 py-2">
                      <StateBadge
                        variant={
                          line.expectedState === 'confirmed'
                            ? 'confirmed'
                            : 'pending'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-start gap-2 text-body-sm">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={isBusy}
              className="mt-1 size-4 shrink-0 accent-accent"
            />
            <span>{t('business_invoice_split_confirm_ack')}</span>
          </label>
        </>
      ) : (
        <>
          <div
            className="flex gap-1 rounded-btn border border-border bg-surface-control p-1"
            role="group"
            aria-label={t('business_invoice_mode_label')}
          >
            {(['simple', 'split'] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={isBusy}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={[
                  'min-h-9 flex-1 rounded-btn px-3 py-1.5 text-body-sm transition-colors',
                  BUSINESS_FOCUS_RING,
                  mode === value
                    ? 'bg-surface font-weight-label text-heading shadow-whisper'
                    : 'text-fg-secondary hover:text-fg',
                ].join(' ')}
              >
                {value === 'simple'
                  ? t('business_invoice_mode_simple')
                  : t('business_invoice_mode_split')}
              </button>
            ))}
          </div>

          <RelationshipReadonlyField
            label={t('business_field_issuer')}
            value={`@${issuer}`}
          />

          {mode === 'simple' ? (
            <>
              <AccountPairSwapRow
                leftLabel={t('business_field_debtor')}
                rightLabel={t('business_field_creditor')}
                leftValue={`@${parties.debtor}`}
                rightValue={`@${parties.creditor}`}
                swapAriaLabel={t('business_invoice_swap_debtor_creditor')}
                disabled={isBusy}
                onSwap={() =>
                  setParties((current) => ({
                    debtor: current.creditor,
                    creditor: current.debtor,
                  }))
                }
              />
              <BusinessField label={t('business_field_amount_usd')} required>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={BUSINESS_FIELD_CLASS}
                />
              </BusinessField>
            </>
          ) : (
            <>
              <AccountPairSwapRow
                leftLabel={t('business_field_debtor')}
                rightLabel={t('business_field_issuer')}
                leftValue={`@${splitDebtor}`}
                rightValue={`@${issuer}`}
                swapAriaLabel={t('business_invoice_swap_debtor_issuer')}
                disabled={isBusy || allowedDebtors.length < 2}
                onSwap={swapSplitDebtor}
              />
              {contracts.length === 0 ? (
                <p className="text-body-sm text-error" role="alert">
                  {t('business_invoice_debtor_contract_required')}
                </p>
              ) : null}
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="sr-only">
                  {t('business_invoice_beneficiaries')}
                </legend>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-body-sm font-weight-label text-fg"
                    aria-hidden
                  >
                    {t('business_invoice_beneficiaries')}
                  </span>
                  <BusinessButton
                    size="sm"
                    disabled={isBusy}
                    onClick={() =>
                      setBeneficiaries((rows) => [
                        ...rows,
                        emptyBeneficiaryLine(),
                      ])
                    }
                  >
                    {t('business_invoice_add_beneficiary')}
                  </BusinessButton>
                </div>
                {beneficiaries.map((line, index) => (
                  <div
                    key={index}
                    className="flex min-w-0 flex-col gap-2 rounded-card border border-border p-3"
                  >
                    <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <UserRefSearchField
                        label={t('business_field_beneficiary')}
                        value={line.beneficiary}
                        onChange={(accountName) =>
                          updateBeneficiary(index, { beneficiary: accountName })
                        }
                        fieldLabel={t('business_field_beneficiary')}
                        searchPlaceholder={t(
                          'business_hive_account_search_placeholder',
                        )}
                        excludeAccountNames={beneficiaryExcludeForRow(index)}
                      />
                      <BusinessField label={t('business_field_amount_usd')}>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.amountUsd}
                          onChange={(e) =>
                            updateBeneficiary(index, {
                              amountUsd: e.target.value,
                            })
                          }
                          className={BUSINESS_FIELD_CLASS}
                        />
                      </BusinessField>
                    </div>
                    <BusinessField label={t('business_field_role')}>
                      <input
                        type="text"
                        value={line.role ?? ''}
                        onChange={(e) =>
                          updateBeneficiary(index, { role: e.target.value })
                        }
                        className={BUSINESS_FIELD_CLASS}
                        placeholder={t('business_invoice_role_optional')}
                      />
                    </BusinessField>
                    {beneficiaries.length > 1 ? (
                      <BusinessButton
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        disabled={isBusy}
                        onClick={() =>
                          setBeneficiaries((rows) =>
                            rows.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t('business_invoice_remove_beneficiary')}
                      </BusinessButton>
                    ) : null}
                  </div>
                ))}
                <RelationshipReadonlyField
                  label={t('business_invoice_total')}
                  value={formatUsd(splitTotal)}
                />
              </fieldset>
              {selfBeneficiary ? (
                <p
                  className={`${BUSINESS_CALLOUT_CLASS} border-error`}
                  role="alert"
                >
                  {t('business_invoice_self_beneficiary_warning', {
                    debtor: normalizeHiveAccountInput(splitDebtor),
                  })}
                </p>
              ) : null}
              {attestor ? (
                <p className={BUSINESS_CALLOUT_CLASS}>
                  {t('business_invoice_attestor_hint')}
                </p>
              ) : null}
            </>
          )}

          {contracts.length > 0 ? (
            <BusinessField
              label={t('business_field_contract')}
              hint={
                contractRequired
                  ? t('business_invoice_contract_required')
                  : undefined
              }
            >
              <select
                value={contractId}
                onChange={(e) => {
                  setContractId(e.target.value);
                  setServiceOrderId('');
                  setReportId('');
                }}
                className={BUSINESS_FIELD_CLASS}
              >
                {!contractRequired ? (
                  <option value="">
                    {t('business_invoice_no_contract_option')}
                  </option>
                ) : null}
                {contracts.map((c) => (
                  <option key={c.contract_id} value={c.contract_id}>
                    {contractDisplayLabel(c)}
                  </option>
                ))}
              </select>
            </BusinessField>
          ) : contractRequired ? (
            <p className="text-body-sm text-error" role="alert">
              {t('business_invoice_contract_required_missing')}
            </p>
          ) : (
            <p className="text-body-sm text-fg-secondary">
              {t('business_field_no_contract')}
            </p>
          )}

          {linkableServiceOrders.length > 0 ? (
            <BusinessField label={t('business_field_service_order')}>
              <select
                value={serviceOrderId}
                onChange={(e) => setServiceOrderId(e.target.value)}
                className={BUSINESS_FIELD_CLASS}
              >
                <option value="">
                  {t('business_report_no_service_order_option')}
                </option>
                {linkableServiceOrders.map((so) => (
                  <option key={so.service_order_id} value={so.service_order_id}>
                    {serviceOrderDisplayLabel(so, contracts)}
                  </option>
                ))}
              </select>
            </BusinessField>
          ) : null}
          {linkableReports.length > 0 ? (
            <BusinessField label={t('business_field_report')}>
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className={BUSINESS_FIELD_CLASS}
              >
                <option value="">
                  {t('business_invoice_no_report_option')}
                </option>
                {linkableReports.map((rep) => (
                  <option key={rep.report_id} value={rep.report_id}>
                    {reportDisplayLabel(rep, contracts)}
                  </option>
                ))}
              </select>
            </BusinessField>
          ) : null}

          <ObjectBuilder
            key={detailsBuilderKey}
            value={{}}
            label={t('business_invoice_details_label')}
            disabled={isBusy}
            onChange={(next, valid) => {
              setDetails(next);
              setDetailsValid(valid);
            }}
          />
        </>
      )}
    </BusinessFormModal>
  );
}
