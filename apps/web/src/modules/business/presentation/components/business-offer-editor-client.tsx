'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { BookOpenIcon } from '@/icons';
import { ModalShell, ModalShellCloseButton } from '@/shared/presentation';

import { useOfferEditor } from '../../application/use-offer-editor';
import {
  computeStepCompleteness,
  type StepCompleteness,
} from '../../domain/offer-draft.schema';
import {
  OFFER_EDITOR_STEPS,
  type OfferEditorStep,
} from '../../domain/offer-form.types';
import { businessRoutes } from '../../domain/routes';
import type { OblOfferDraftView } from '../../infrastructure/clients/obl-drafts.server';
import {
  EditorStepNav,
  EditorStepProgress,
} from './offer-editor/editor-step-nav';
import { OfferEditorBasicsStep } from './offer-editor/offer-editor-basics-step';
import { OfferEditorBillingStep } from './offer-editor/offer-editor-billing-step';
import { OfferEditorCommercialStep } from './offer-editor/offer-editor-commercial-step';
import { OfferEditorDisputesStep } from './offer-editor/offer-editor-disputes-step';
import { OfferEditorLegalStep } from './offer-editor/offer-editor-legal-step';
import { OfferEditorReviewStep } from './offer-editor/offer-editor-review-step';
import { OfferEditorSchemaStep } from './offer-editor/offer-editor-schema-step';
import { OfferEditorServiceStep } from './offer-editor/offer-editor-service-step';
import { OfferEditorTerminationStep } from './offer-editor/offer-editor-termination-step';
import { OfferFullPreview } from './offer-full-preview';
import { useOblBroadcast } from '../hooks/use-obl-broadcast';
import { BusinessPageShell } from '../layout/business-page-shell';
import { BusinessBreadcrumbs } from '../ui/business-breadcrumbs';
import { BusinessButton } from '../ui/business-button';
import { BusinessSaveStatus } from '../ui/business-save-status';
import { businessCardClass } from '../ui/classes';

const PREVIEW_ICON_SIZE = 16;

export type BusinessOfferEditorClientProps = {
  username: string;
  draft: OblOfferDraftView;
};

export function BusinessOfferEditorClient({
  username,
  draft,
}: BusinessOfferEditorClientProps) {
  const { t } = useI18n();
  const { broadcast, phase, isBusy, error } = useOblBroadcast(username);
  const editor = useOfferEditor({ username, draft, broadcast });

  const previewTitleId = 'offer-full-preview-title';
  const isOffer = draft.kind === 'offer';
  const stepCount = OFFER_EDITOR_STEPS.length;
  const isLastStep = editor.stepIndex >= stepCount - 1;
  const stepLabel = t(`business_editor_step_${editor.step}`);
  const stepProgress = t('business_editor_step_progress', {
    current: editor.stepIndex + 1,
    total: stepCount,
  });

  const completeness = useMemo(
    () =>
      Object.fromEntries(
        OFFER_EDITOR_STEPS.map((step) => [
          step,
          computeStepCompleteness(step, editor.state),
        ]),
      ) as Record<OfferEditorStep, StepCompleteness>,
    [editor.state],
  );

  return (
    <>
      <BusinessPageShell
        title={editor.fields.name?.trim() || t('business_draft_untitled')}
        subtitle={`${t('business_editor_draft_label')} · ${t(`business_kind_label_${draft.kind}`)}`}
        breadcrumbs={
          <BusinessBreadcrumbs
            items={[
              {
                label: isOffer
                  ? t('business_nav_my_offers')
                  : t('business_nav_my_requests'),
                href: businessRoutes.manageTab(draft.kind, 'drafts'),
              },
              {
                label: t('business_offers_tab_drafts'),
                href: businessRoutes.manageTab(draft.kind, 'drafts'),
              },
              {
                label:
                  editor.fields.name?.trim() || t('business_draft_untitled'),
              },
            ]}
          />
        }
        railLabel={`${stepProgress} · ${stepLabel}`}
        rail={
          <EditorStepNav
            current={editor.step}
            completeness={completeness}
            onSelect={editor.setStep}
          />
        }
        actions={
          <>
            <BusinessSaveStatus
              state={editor.saveState}
              onRetry={() => void editor.retrySave()}
            />
            <BusinessButton
              size="sm"
              onClick={() => editor.setPreviewOpen(true)}
            >
              <BookOpenIcon size={PREVIEW_ICON_SIZE} />
              {t('business_full_preview')}
            </BusinessButton>
          </>
        }
      >
        <div className="mb-card-padding flex flex-col gap-2 lg:hidden">
          <EditorStepProgress current={editor.step} />
        </div>

        <section
          className={businessCardClass()}
          aria-labelledby="offer-editor-step-title"
        >
          <p className="text-caption text-fg-secondary">{stepProgress}</p>
          <h2
            id="offer-editor-step-title"
            className="mb-card-padding text-body font-weight-strong text-heading"
          >
            {stepLabel}
          </h2>
          {editor.step === 'basics' ? (
            <OfferEditorBasicsStep
              kind={editor.kind}
              fields={editor.fields}
              onKindChange={editor.setKind}
              onFieldsChange={editor.setFields}
              kindLocked
            />
          ) : null}
          {editor.step === 'service' ? (
            <OfferEditorServiceStep
              username={username}
              kind={editor.kind}
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'schema' ? (
            <OfferEditorSchemaStep
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'commercial' ? (
            <OfferEditorCommercialStep
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'billing' ? (
            <OfferEditorBillingStep
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'termination' ? (
            <OfferEditorTerminationStep
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'disputes' ? (
            <OfferEditorDisputesStep
              fields={editor.fields}
              onFieldsChange={editor.setFields}
            />
          ) : null}
          {editor.step === 'legal' ? (
            <OfferEditorLegalStep
              username={username}
              fields={editor.fields}
              legalText={editor.legalText}
              onFieldsChange={editor.setFields}
              onLegalTextChange={editor.setLegalText}
            />
          ) : null}
          {editor.step === 'review' ? (
            <OfferEditorReviewStep
              state={editor.state}
              phase={phase}
              isBusy={isBusy}
              error={error}
              onPublish={() => void editor.publish()}
              onGoToStep={editor.setStep}
            />
          ) : null}
        </section>

        {/* Sticky on mobile so Back / Continue stay under the thumb on long steps. */}
        <div className="mt-card-padding flex items-center justify-between gap-2 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-gutter max-lg:border-t max-lg:border-border max-lg:bg-bg max-lg:px-gutter max-lg:py-3 sm:max-lg:-mx-gutter-sm sm:max-lg:px-gutter-sm">
          <BusinessButton
            disabled={editor.stepIndex <= 0}
            onClick={editor.goBack}
          >
            {t('business_back')}
          </BusinessButton>
          {isLastStep ? null : (
            <BusinessButton variant="primary" onClick={editor.goNext}>
              {t('business_continue')}
            </BusinessButton>
          )}
        </div>
      </BusinessPageShell>

      <ModalShell
        open={editor.previewOpen}
        onClose={() => editor.setPreviewOpen(false)}
        labelledBy={previewTitleId}
        maxWidthClass="max-w-container-narrow"
        scrollBody
        align="start"
        header={
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-card-padding py-3">
            <h2
              id={previewTitleId}
              className="text-body font-weight-strong text-heading"
            >
              {t('business_full_preview')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={editor.previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-sm text-link hover:underline"
              >
                {t('business_full_preview_open_tab')}
              </Link>
              <ModalShellCloseButton
                onClose={() => editor.setPreviewOpen(false)}
                ariaLabel={t('business_modal_close')}
              />
            </div>
          </div>
        }
      >
        <div className="p-card-padding">
          <OfferFullPreview state={editor.state} author={username} />
        </div>
      </ModalShell>
    </>
  );
}
