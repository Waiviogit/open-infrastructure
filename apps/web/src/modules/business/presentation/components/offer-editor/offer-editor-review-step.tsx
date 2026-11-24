'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { MessageKey } from '@/i18n/types';

import {
  computeStepCompleteness,
  publishErrorMessageKey,
  validateOfferDraftForPublish,
} from '../../../domain/offer-draft.schema';
import {
  OFFER_EDITOR_STEPS,
  type OfferDraftState,
  type OfferEditorStep,
} from '../../../domain/offer-form.types';
import { BusinessButton } from '../../ui/business-button';
import { BusinessActionError } from '../../ui/business-states';
import { BusinessDisclosure } from '../business-disclosure';
import { StateBadge } from '../state-badge';

export type OfferEditorReviewStepProps = {
  state: OfferDraftState;
  phase: string;
  isBusy?: boolean;
  error: string | null;
  onPublish: () => void;
  onGoToStep?: (step: OfferEditorStep) => void;
};

const CHECKLIST_STEPS = OFFER_EDITOR_STEPS.filter((s) => s !== 'review');

type ChecklistStatus = 'blocked' | 'ready' | 'optional' | 'incomplete';

const STATUS_DOT_CLASS: Record<ChecklistStatus, string> = {
  ready: 'bg-success',
  optional: 'bg-fg-tertiary',
  incomplete: 'bg-error',
  blocked: 'bg-error',
};

const STATUS_LABEL_KEY: Record<ChecklistStatus, MessageKey> = {
  ready: 'business_review_checklist_ok',
  optional: 'business_review_checklist_optional',
  incomplete: 'business_step_incomplete',
  blocked: 'business_review_checklist_blocked',
};

function stepStatus(
  step: OfferEditorStep,
  state: OfferDraftState,
  stepErrors: string[],
): ChecklistStatus {
  if (stepErrors.length > 0) {
    return 'blocked';
  }
  const completeness = computeStepCompleteness(step, state);
  if (completeness === 'complete') {
    return 'ready';
  }
  if (completeness === 'empty') {
    return 'optional';
  }
  return 'incomplete';
}

export function OfferEditorReviewStep({
  state,
  phase,
  isBusy = false,
  error,
  onPublish,
  onGoToStep,
}: OfferEditorReviewStepProps) {
  const { t } = useI18n();
  const validation = validateOfferDraftForPublish(state);
  const canPublish = validation.ok;

  const blockingIssues = CHECKLIST_STEPS.flatMap((step) => {
    const codes = !validation.ok ? (validation.errors[step] ?? []) : [];
    return codes.map((code) => ({
      step,
      code,
      message: t(publishErrorMessageKey(code)),
    }));
  });

  return (
    <div className="flex flex-col gap-4">
      <BusinessDisclosure variant="immutable_version" />
      <h3 className="text-body font-weight-strong text-heading">
        {t('business_review_checklist_title')}
      </h3>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {CHECKLIST_STEPS.map((step) => {
          const stepErrors = !validation.ok
            ? (validation.errors[step] ?? [])
            : [];
          const status = stepStatus(step, state, stepErrors);
          const needsFix = status === 'blocked' || status === 'incomplete';

          return (
            <li key={step} className="px-3 py-1 text-body-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-weight-label">
                  {t(`business_editor_step_${step}`)}
                </span>
                <div className="flex min-h-9 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 ${needsFix ? 'text-error' : 'text-fg'}`}
                  >
                    <span
                      className={`size-2 shrink-0 rounded-circle ${STATUS_DOT_CLASS[status]}`}
                      aria-hidden
                    />
                    {t(STATUS_LABEL_KEY[status])}
                  </span>
                  {needsFix && onGoToStep ? (
                    <BusinessButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onGoToStep(step)}
                    >
                      {t('business_review_fix_step')}
                    </BusinessButton>
                  ) : null}
                </div>
              </div>
              {stepErrors.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 text-caption text-error">
                  {stepErrors.map((code) => (
                    <li key={code}>{t(publishErrorMessageKey(code))}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!canPublish ? (
        <div
          className="rounded-card border border-error bg-surface px-3 py-2 text-body-sm text-error"
          role="alert"
        >
          <p className="font-weight-label">{t('business_publish_blocked')}</p>
          {blockingIssues.length > 0 ? (
            <ul className="mt-2 list-disc ps-5">
              {blockingIssues.map((issue) => (
                <li key={`${issue.step}-${issue.code}`}>
                  <span className="font-weight-label">
                    {t(`business_editor_step_${issue.step}`)}:
                  </span>{' '}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {phase === 'indexing' ? <StateBadge variant="indexing" /> : null}
      <BusinessActionError message={error} />
      <BusinessButton
        variant="primary"
        disabled={!canPublish}
        busy={isBusy}
        onClick={onPublish}
        className="self-start"
      >
        {t('business_publish_version')}
      </BusinessButton>
    </div>
  );
}
