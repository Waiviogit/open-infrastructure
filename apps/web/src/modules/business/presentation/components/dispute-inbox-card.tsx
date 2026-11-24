'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';

import type {
  LedgerDisputeRow,
  LedgerInvoiceRow,
} from '../../domain/ledger.types';
import { businessRoutes } from '../../domain/routes';
import { BusinessButton } from '../ui/business-button';
import {
  BUSINESS_BREAK_TEXT,
  businessButtonClass,
  businessCardClass,
} from '../ui/classes';
import { DisputeSettlementSummary } from './relationship/dispute-settlement-summary';
import { StateBadge } from './state-badge';

export type DisputeInboxRow = {
  dispute: LedgerDisputeRow;
  invoice: LedgerInvoiceRow;
  offerName: string;
  pair: { provider: string; client: string };
};

export type DisputeInboxCardProps = {
  row: DisputeInboxRow;
  viewer: string;
  /** `arbiter`: a third party deciding; `party`: the provider or client deciding by contract rule. */
  role: 'arbiter' | 'party';
  isBusy: boolean;
  onResolve: () => void;
};

/** One dispute in the arbitration / dispute-resolution inbox. */
export function DisputeInboxCard({
  row,
  viewer,
  role,
  isBusy,
  onResolve,
}: DisputeInboxCardProps) {
  const { t } = useI18n();
  const isOpen = row.dispute.status === 'open';
  const counterparty =
    viewer === row.pair.provider ? row.pair.client : row.pair.provider;

  return (
    <li className={businessCardClass()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`text-body font-weight-strong text-heading ${BUSINESS_BREAK_TEXT}`}
            >
              <Link
                href={businessRoutes.dispute(row.dispute.dispute_id)}
                className="hover:underline"
                suppressHydrationWarning
              >
                {row.offerName || t('business_dispute_untitled')}
              </Link>
            </h2>
            <StateBadge variant={isOpen ? 'disputed' : 'resolved'} />
          </div>
          <p
            className={`mt-0.5 text-caption text-fg-secondary ${BUSINESS_BREAK_TEXT}`}
          >
            {t('business_dispute_pair', {
              provider: `@${row.pair.provider}`,
              client: `@${row.pair.client}`,
            })}{' '}
            · <ActivityTimestamp timestamp={row.dispute.created_at} />
          </p>
          <DisputeSettlementSummary
            dispute={row.dispute}
            invoice={row.invoice}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          {isOpen ? (
            <BusinessButton
              variant="primary"
              size="sm"
              disabled={isBusy}
              onClick={onResolve}
            >
              {t('business_dispute_resolve_action')}
            </BusinessButton>
          ) : null}
          {role === 'party' ? (
            <Link
              href={businessRoutes.relationshipTab(counterparty, 'disputes')}
              className={businessButtonClass({
                variant: 'secondary',
                size: 'sm',
              })}
              suppressHydrationWarning
            >
              {t('business_dispute_resolution_view_relationship')}
            </Link>
          ) : (
            <Link
              href={businessRoutes.dispute(row.dispute.dispute_id)}
              className={businessButtonClass({
                variant: 'secondary',
                size: 'sm',
              })}
              suppressHydrationWarning
            >
              {t('business_view_dispute')}
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
