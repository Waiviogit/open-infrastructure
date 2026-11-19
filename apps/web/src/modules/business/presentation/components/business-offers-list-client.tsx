'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { BriefcaseIcon, ChevronRightIcon, HandHelpingIcon } from '@/icons';
import { ActivityTimestamp } from '@/modules/user-activity/presentation/components/activity-timestamp';
import {
  AppLoader,
  useInfiniteScroll,
  useSyncedPaginatedList,
} from '@/shared/presentation';

import {
  loadMoreManageOffersAction,
  loadMoreOblDraftsAction,
} from '../../infrastructure/actions/load-more-obl.server';
import {
  businessNavIdForKind,
  businessRoutes,
  type OblOfferKindRoute,
  type OffersListTab,
} from '../../domain/routes';
import type { OblOffsetPage } from '../../domain/obl-pagination.types';
import type { OblOfferDraftView } from '../../infrastructure/clients/obl-drafts.server';
import type { OblOfferApiRow } from '../../infrastructure/clients/obl-offers.server';
import { createOblDraftAction } from '../../infrastructure/actions/obl-drafts.actions';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessButton } from '../ui/business-button';
import { BusinessSubTabs } from '../ui/business-sub-tabs';
import { BusinessEmptyState, BusinessErrorState } from '../ui/business-states';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../ui/classes';
import { OfferCard } from './offer-card';
import { StateBadge } from './state-badge';

const LIST_TABS: readonly OffersListTab[] = ['drafts', 'published', 'retired'];

export type BusinessOffersListClientProps = {
  username: string;
  kind: OblOfferKindRoute;
  tab: OffersListTab;
  initialDrafts: OblOffsetPage<OblOfferDraftView>;
  initialPublished: OblOffsetPage<OblOfferApiRow>;
  loadFailed?: boolean;
};

function draftName(draft: OblOfferDraftView): string {
  const name = (draft.fields as { name?: unknown }).name;
  return typeof name === 'string' ? name.trim() : '';
}

export function BusinessOffersListClient({
  username,
  kind,
  tab,
  initialDrafts,
  initialPublished,
  loadFailed = false,
}: BusinessOffersListClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createErrorKey, setCreateErrorKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draftsState = useSyncedPaginatedList(initialDrafts);
  const publishedState = useSyncedPaginatedList(initialPublished);

  /** The drafts API returns both kinds: filter here and keep paging until this kind shows up. */
  const kindDrafts = useMemo(
    () => draftsState.items.filter((draft) => draft.kind === kind),
    [draftsState.items, kind],
  );

  const isOffer = kind === 'offer';
  const title = isOffer
    ? t('business_offers_title')
    : t('business_requests_title');
  const subtitle = isOffer
    ? t('business_offers_subtitle')
    : t('business_requests_subtitle');
  const createLabel = isOffer
    ? t('business_create_offer')
    : t('business_create_request');
  const kindIcon = isOffer ? (
    <BriefcaseIcon size={20} />
  ) : (
    <HandHelpingIcon size={20} />
  );

  const onLoadMoreDrafts = useCallback(() => {
    if (!draftsState.hasMore || pending) {
      return;
    }
    startTransition(async () => {
      const next = await loadMoreOblDraftsAction(
        username,
        draftsState.items.length,
      );
      draftsState.setItems((prev) => [...prev, ...next.items]);
      draftsState.setHasMore(next.hasMore);
    });
  }, [draftsState, pending, username]);

  const onLoadMorePublished = useCallback(() => {
    if (!publishedState.hasMore || pending) {
      return;
    }
    startTransition(async () => {
      const next = await loadMoreManageOffersAction({
        author: username,
        kind,
        status: tab === 'retired' ? 'retired' : 'active',
        offset: publishedState.items.length,
      });
      publishedState.setItems((prev) => [...prev, ...next.items]);
      publishedState.setHasMore(next.hasMore);
    });
  }, [kind, pending, publishedState, tab, username]);

  const isDraftsTab = tab === 'drafts';
  const { sentinelRef } = useInfiniteScroll({
    hasMore: isDraftsTab ? draftsState.hasMore : publishedState.hasMore,
    isLoading: pending,
    onLoadMore: isDraftsTab ? onLoadMoreDrafts : onLoadMorePublished,
  });

  async function onCreateDraft() {
    setCreating(true);
    setCreateErrorKey(null);
    try {
      const result = await createOblDraftAction(username, {
        kind,
        fields: { name: '' },
      });
      if (result.ok) {
        const draftId = result.value.draftId?.trim();
        if (draftId) {
          router.push(businessRoutes.offerDraft(kind, draftId));
          return;
        }
        setCreateErrorKey('business_draft_create_error_generic');
        return;
      }
      setCreateErrorKey(
        result.error.code === 'unauthorized'
          ? 'business_draft_create_error_unauthorized'
          : 'business_draft_create_error_generic',
      );
    } catch {
      setCreateErrorKey('business_draft_create_error_generic');
    } finally {
      setCreating(false);
    }
  }

  const createButton = (
    <BusinessButton
      variant="primary"
      busy={creating}
      onClick={() => void onCreateDraft()}
    >
      {createLabel}
    </BusinessButton>
  );

  const tabs = LIST_TABS.map((id) => ({
    id,
    href: businessRoutes.manageTab(kind, id),
    label: t(`business_offers_tab_${id}`),
  }));

  function draftsBody() {
    if (kindDrafts.length === 0) {
      if (draftsState.hasMore) {
        return (
          <AppLoader
            size="sm"
            label={t('business_loading')}
            className="py-section-y-sm"
          />
        );
      }
      return (
        <BusinessEmptyState
          icon={kindIcon}
          title={t('business_offers_drafts_empty_title')}
          description={t('business_offers_drafts_empty_body')}
          action={createButton}
        />
      );
    }
    return (
      <ul className="flex flex-col gap-card-padding">
        {kindDrafts.map((draft) => {
          const name = draftName(draft);
          return (
            <li key={draft.draftId}>
              <Link
                href={businessRoutes.offerDraft(kind, draft.draftId)}
                className={businessCardClass({ interactive: true })}
                suppressHydrationWarning
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        'line-clamp-2 text-body',
                        BUSINESS_BREAK_TEXT,
                        name
                          ? 'font-weight-strong text-heading'
                          : 'italic text-fg-secondary',
                      ].join(' ')}
                    >
                      {name || t('business_draft_untitled')}
                    </p>
                    <p className="mt-0.5 text-caption text-fg-secondary">
                      {t('business_last_edited')}{' '}
                      <ActivityTimestamp
                        timestamp={new Date(
                          draft.lastUpdated * 1000,
                        ).toISOString()}
                      />
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-body-sm text-link sm:inline">
                    {t('business_continue_editing')}
                  </span>
                  <ChevronRightIcon
                    size={18}
                    className="shrink-0 text-fg-tertiary rtl:rotate-180"
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  function publishedBody() {
    const rows = publishedState.items;
    if (rows.length === 0) {
      const retired = tab === 'retired';
      return (
        <BusinessEmptyState
          icon={kindIcon}
          title={
            retired
              ? t('business_offers_retired_empty_title')
              : t('business_offers_published_empty_title')
          }
          description={
            retired
              ? t('business_offers_retired_empty_body')
              : t('business_offers_published_empty_body')
          }
          action={retired ? undefined : createButton}
        />
      );
    }
    return (
      <ul className="flex flex-col gap-card-padding">
        {rows.map((offer) => (
          <li key={`${offer.offer_id}-${offer.version}`}>
            <OfferCard
              offer={offer}
              href={businessRoutes.offerDetail(offer.offer_id)}
              showAuthor={false}
              badge={
                <StateBadge
                  variant={offer.status === 'active' ? 'active' : 'retired'}
                />
              }
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <BusinessPageShell
      activeNav={businessNavIdForKind(kind)}
      title={title}
      subtitle={subtitle}
      actions={
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {createButton}
          {createErrorKey ? (
            <p
              className="max-w-sm text-caption text-error sm:text-end"
              role="alert"
            >
              {t(createErrorKey)}
            </p>
          ) : null}
        </div>
      }
    >
      <BusinessSubTabs items={tabs} activeId={tab} ariaLabel={title} />
      {loadFailed ? (
        <BusinessErrorState />
      ) : isDraftsTab ? (
        draftsBody()
      ) : (
        publishedBody()
      )}
      <div ref={sentinelRef} className="h-4" aria-hidden />
    </BusinessPageShell>
  );
}
