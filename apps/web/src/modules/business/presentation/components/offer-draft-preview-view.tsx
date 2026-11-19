'use client';

import Link from 'next/link';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { ChevronLeftIcon } from '@/icons';

import type { OfferDraftState } from '../../domain/offer-form.types';
import { businessRoutes } from '../../domain/routes';
import { BUSINESS_SHELL_GRID_CLASS } from '../layout/business-page-shell';
import { BusinessBreadcrumbs } from '../ui/business-breadcrumbs';
import { businessButtonClass } from '../ui/classes';
import { OfferFullPreview } from './offer-full-preview';

const BACK_ICON_SIZE = 16;

export type OfferDraftPreviewViewProps = {
  draftId: string;
  state: OfferDraftState;
  author: string;
};

/**
 * `/business/manage/{offers,requests}/drafts/:id/preview`: the draft laid out like its public
 * offer page, under the editor's breadcrumbs, with a way back to the editor.
 */
export function OfferDraftPreviewView({
  draftId,
  state,
  author,
}: OfferDraftPreviewViewProps) {
  const { t } = useI18n();
  const { kind } = state;
  const editorHref = businessRoutes.offerDraft(kind, draftId);
  const draftTitle = state.fields.name?.trim() || t('business_draft_untitled');

  return (
    <div
      className={`mt-card-padding pb-section-y ${BUSINESS_SHELL_GRID_CLASS}`}
    >
      <div className="flex min-w-0 flex-col gap-card-padding lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-sm:hidden">
            <BusinessBreadcrumbs
              items={[
                {
                  label:
                    kind === 'offer'
                      ? t('business_nav_my_offers')
                      : t('business_nav_my_requests'),
                  href: businessRoutes.manageTab(kind, 'drafts'),
                },
                {
                  label: t('business_offers_tab_drafts'),
                  href: businessRoutes.manageTab(kind, 'drafts'),
                },
                { label: draftTitle, href: editorHref },
                { label: t('business_full_preview') },
              ]}
            />
          </div>
          <Link
            href={editorHref}
            className={businessButtonClass({ size: 'sm' })}
            suppressHydrationWarning
          >
            <ChevronLeftIcon size={BACK_ICON_SIZE} className="rtl:rotate-180" />
            {t('business_back_to_editor')}
          </Link>
        </div>
        <OfferFullPreview
          state={state}
          author={author}
          titleAs="h1"
          layout="split"
        />
      </div>
    </div>
  );
}
