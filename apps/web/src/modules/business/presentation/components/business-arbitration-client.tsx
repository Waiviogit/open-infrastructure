'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useOblCustomJsonId } from '@/config/odl-network-provider';
import { CheckCircleIcon, FlagIcon } from '@/icons';
import {
  useInfiniteScroll,
  useSyncedPaginatedList,
} from '@/shared/presentation';

import { buildResolveDisputeOp } from '../../application/build-obl-ops';
import {
  ARBITRATION_STATUSES,
  buildArbitrationHref,
  type ArbitrationStatus,
} from '../../domain/arbitration-status-url';
import type { DisputeAuthority } from '../../domain/dispute-resolution';
import type { LedgerDisputeRow } from '../../domain/ledger.types';
import type { OblCursorPage } from '../../domain/obl-pagination.types';
import { loadMoreOblArbitrationAction } from '../../infrastructure/actions/load-more-obl.server';
import type { ArbitrationDisputeApiRow } from '../../infrastructure/clients/obl-arbitration.server';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessRailNav } from '../ui/business-context-rail';
import { BusinessEmptyState, BusinessErrorState } from '../ui/business-states';
import { DisputeInboxCard } from './dispute-inbox-card';
import { BusinessResolveDisputeModal } from './relationship/business-resolve-dispute-modal';
import { StateBadge } from './state-badge';

export function BusinessArbitrationClient({
  username,
  status,
  initialPage,
  loadFailed = false,
}: {
  username: string;
  status: ArbitrationStatus;
  initialPage: OblCursorPage<ArbitrationDisputeApiRow>;
  loadFailed?: boolean;
}) {
  const { t } = useI18n();
  const oblCustomJsonId = useOblCustomJsonId();
  const [pending, startTransition] = useTransition();
  const [resolveRow, setResolveRow] = useState<ArbitrationDisputeApiRow | null>(
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
      const next = await loadMoreOblArbitrationAction(username, status, cursor);
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

  const resolveAuthority = useMemo((): DisputeAuthority | null => {
    if (!resolveRow) {
      return null;
    }
    return {
      rule: 'arbiter',
      resolverAccount: username,
      provider: resolveRow.pair.provider,
      client: resolveRow.pair.client,
      arbiter: resolveRow.contract.arbiter,
    };
  }, [resolveRow, username]);

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
        refreshArbitration: true,
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

  const tabs = ARBITRATION_STATUSES.map((value) => ({
    id: value,
    href: buildArbitrationHref(value),
    label: t(`business_arbitration_filter_${value}`),
    icon:
      value === 'open' ? <FlagIcon size={16} /> : <CheckCircleIcon size={16} />,
  }));

  return (
    <>
      <BusinessPageShell
        title={t('business_arbitration_title')}
        railLabel={t(`business_arbitration_filter_${status}`)}
        rail={
          <BusinessRailNav
            items={tabs}
            activeId={status}
            ariaLabel={t('business_arbitration_title')}
          />
        }
        subtitle={t('business_arbitration_subtitle')}
      >
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
            title={t('business_arbitration_empty_title')}
            description={t('business_arbitration_empty_body')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-card-padding">
              {items.map((row) => (
                <DisputeInboxCard
                  key={row.dispute.dispute_id}
                  row={row}
                  viewer={username}
                  role="arbiter"
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
