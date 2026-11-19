'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';
import { FlagIcon } from '@/icons';
import {
  useInfiniteScroll,
  useSyncedPaginatedList,
} from '@/shared/presentation';

import { buildResolveDisputeOp } from '../../application/build-obl-ops';
import {
  DISPUTE_RESOLUTION_STATUSES,
  buildDisputeResolutionHref,
  type DisputeResolutionStatus,
} from '../../domain/dispute-resolution-status-url';
import { disputeAuthorityForInvoice } from '../../domain/dispute-resolution';
import { toLedgerContractRow } from '../../domain/ledger-contract';
import type { LedgerDisputeRow } from '../../domain/ledger.types';
import type { OblCursorPage } from '../../domain/obl-pagination.types';
import { loadMoreOblDisputeResolutionAction } from '../../infrastructure/actions/load-more-obl.server';
import type { DisputeResolutionApiRow } from '../../infrastructure/clients/obl-dispute-resolution.server';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessSubTabs } from '../ui/business-sub-tabs';
import { BusinessEmptyState, BusinessErrorState } from '../ui/business-states';
import { DisputeInboxCard } from './dispute-inbox-card';
import { BusinessResolveDisputeModal } from './relationship/business-resolve-dispute-modal';
import { StateBadge } from './state-badge';

export function BusinessDisputeResolutionClient({
  username,
  status,
  initialPage,
  loadFailed = false,
}: {
  username: string;
  status: DisputeResolutionStatus;
  initialPage: OblCursorPage<DisputeResolutionApiRow>;
  loadFailed?: boolean;
}) {
  const { t } = useI18n();
  const oblCustomJsonId = useOblCustomJsonId();
  const [pending, startTransition] = useTransition();
  const [resolveRow, setResolveRow] = useState<DisputeResolutionApiRow | null>(
    null,
  );
  const { items, setItems, hasMore, setHasMore, cursor, setCursor } =
    useSyncedPaginatedList({
      items: initialPage.items,
      hasMore: initialPage.hasMore,
      cursor: initialPage.nextCursor,
    });
  const { broadcast, isBusy, phase, error, setError } =
    useOblBroadcast(username);

  const onLoadMore = useCallback(() => {
    if (!hasMore || pending || !cursor) {
      return;
    }
    startTransition(async () => {
      const next = await loadMoreOblDisputeResolutionAction(
        username,
        status,
        cursor,
      );
      setItems((prev) => [...prev, ...next.items]);
      setHasMore(next.hasMore);
      setCursor(next.nextCursor);
    });
  }, [
    cursor,
    hasMore,
    pending,
    setCursor,
    setHasMore,
    setItems,
    status,
    username,
  ]);

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: pending,
    onLoadMore,
  });

  const resolveAuthority = useMemo(() => {
    if (!resolveRow) {
      return null;
    }
    const contract = toLedgerContractRow(
      resolveRow.contract,
      resolveRow.offerName,
    );
    return disputeAuthorityForInvoice(resolveRow.invoice, [contract], contract);
  }, [resolveRow]);

  async function submitResolve(
    dispute: LedgerDisputeRow,
    finalAmountUsd: string,
  ): Promise<boolean> {
    if (!resolveRow) {
      return false;
    }
    const txId = await broadcast(
      [
        buildResolveDisputeOp({
          oblCustomJsonId,
          disputeId: dispute.dispute_id,
          resolver: username,
          finalAmountUsd,
        }),
      ],
      {
        refreshDisputeResolution: true,
        disputeId: dispute.dispute_id,
        ledgerPairs: [
          {
            accountA: resolveRow.pair.provider,
            accountB: resolveRow.pair.client,
          },
        ],
      },
    );
    return txId !== null;
  }

  const tabs = DISPUTE_RESOLUTION_STATUSES.map((value) => ({
    id: value,
    href: buildDisputeResolutionHref(value),
    label: t(`business_dispute_resolution_filter_${value}`),
  }));

  return (
    <>
      <BusinessPageShell
        activeNav="dispute-resolution"
        title={t('business_dispute_resolution_title')}
        subtitle={t('business_dispute_resolution_subtitle')}
      >
        <BusinessSubTabs
          items={tabs}
          activeId={status}
          ariaLabel={t('business_dispute_resolution_title')}
        />
        {phase === 'indexing' ? (
          <div className="mb-card-padding">
            <StateBadge variant="indexing" />
          </div>
        ) : null}

        {loadFailed ? (
          <BusinessErrorState />
        ) : items.length === 0 ? (
          <BusinessEmptyState
            icon={<FlagIcon size={20} />}
            title={t('business_dispute_resolution_empty_title')}
            description={t('business_dispute_resolution_empty_body')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-card-padding">
              {items.map((row) => (
                <DisputeInboxCard
                  key={row.dispute.dispute_id}
                  row={row}
                  viewer={username}
                  role="party"
                  isBusy={isBusy}
                  onResolve={() => {
                    setError(null);
                    setResolveRow(row);
                  }}
                />
              ))}
            </ul>
            <div ref={sentinelRef} className="h-4" aria-hidden />
          </>
        )}
      </BusinessPageShell>

      <BusinessResolveDisputeModal
        open={resolveRow !== null}
        dispute={resolveRow?.dispute ?? null}
        invoice={resolveRow?.invoice ?? null}
        authority={resolveAuthority}
        onClose={() => setResolveRow(null)}
        isBusy={isBusy}
        error={error}
        onSubmit={submitResolve}
      />
    </>
  );
}
