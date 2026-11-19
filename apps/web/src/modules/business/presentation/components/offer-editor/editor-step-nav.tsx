'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { CheckIcon } from '@/icons';
import { railItemClass } from '@/shared/presentation';

import type { StepCompleteness } from '../../../domain/offer-draft.schema';
import {
  OFFER_EDITOR_STEPS,
  type OfferEditorStep,
} from '../../../domain/offer-form.types';
import { BUSINESS_FOCUS_RING } from '../../ui/classes';

export type EditorStepNavProps = {
  current: OfferEditorStep;
  completeness: Readonly<Record<OfferEditorStep, StepCompleteness>>;
  onSelect: (step: OfferEditorStep) => void;
};

/** Step marker: ✓ when complete, ! when it blocks publishing, otherwise the step number. */
function StepMarker({
  index,
  state,
  active,
}: {
  index: number;
  state: StepCompleteness;
  active: boolean;
}) {
  const base =
    'inline-flex size-6 shrink-0 items-center justify-center rounded-circle text-caption tabular-nums';
  if (state === 'complete') {
    return (
      <span
        className={`${base} border border-border-strong bg-surface-control text-heading`}
      >
        <CheckIcon size={14} />
      </span>
    );
  }
  if (state === 'incomplete') {
    return (
      <span
        className={`${base} border border-error font-weight-strong text-error`}
      >
        !
      </span>
    );
  }
  return (
    <span
      className={`${base} border ${active ? 'border-accent text-accent' : 'border-border text-fg-secondary'}`}
    >
      {index + 1}
    </span>
  );
}

/**
 * The editor steps as a rail (desktop) or drawer list (mobile). Status is told by the marker
 * and by text for screen readers, never by colour alone.
 */
export function EditorStepNav({
  current,
  completeness,
  onSelect,
}: EditorStepNavProps) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('business_editor_steps_aria')}>
      <ol className="flex flex-col gap-0.5">
        {OFFER_EDITOR_STEPS.map((step, index) => {
          const active = step === current;
          const state = completeness[step];
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onSelect(step)}
                aria-current={active ? 'step' : undefined}
                className={`${railItemClass(active)} min-h-10 text-start max-lg:min-h-11 ${BUSINESS_FOCUS_RING}`}
              >
                <StepMarker index={index} state={state} active={active} />
                <span className="min-w-0 flex-1 truncate">
                  {t(`business_editor_step_${step}`)}
                </span>
                <span className="sr-only">
                  {t(`business_editor_step_state_${state}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Thin progress bar for the mobile step trigger. */
export function EditorStepProgress({ current }: { current: OfferEditorStep }) {
  const index = OFFER_EDITOR_STEPS.indexOf(current);
  const percent = Math.round(((index + 1) / OFFER_EDITOR_STEPS.length) * 100);
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-pill bg-surface-control"
      aria-hidden
    >
      <div
        className="h-full rounded-pill bg-accent transition-[width]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
