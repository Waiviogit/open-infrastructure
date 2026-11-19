'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { UserAvatar } from '@/shared/presentation';

import { parseOfferCommercialSummary } from '../../domain/offer-commercial-summary';
import {
  getOfferTerms,
  type OfferDraftState,
} from '../../domain/offer-form.types';
import {
  BusinessDetailSection,
  type BusinessDetailRow,
} from '../ui/business-detail-list';
import { BUSINESS_BREAK_TEXT, businessCardClass } from '../ui/classes';
import { BusinessDisclosure } from './business-disclosure';
import { useOfferPriceLabel } from './offer-card';
import { OfferTermsSummary } from './offer-terms-summary';

const AUTHOR_AVATAR_SIZE = 32;

/** Same columns as the public offer page: content | sign panel. */
const SPLIT_GRID_CLASS =
  'grid items-start gap-card-padding lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]';

/** The sign column sticks below the app header and the hub section nav. */
const SPLIT_ASIDE_CLASS =
  'flex min-w-0 flex-col gap-card-padding lg:sticky lg:top-[calc(var(--shell-header-height)+var(--hub-section-nav-height,0px)+var(--spacing-card))]';

export type OfferFullPreviewProps = {
  state: OfferDraftState;
  author?: string;
  /** `h1` on the standalone preview page, `h2` inside the editor's preview modal. */
  titleAs?: 'h1' | 'h2';
  /** `split` (preview page): the public page's two columns from `lg`. `stacked` (modal): one column. */
  layout?: 'stacked' | 'split';
};

/**
 * The draft as a counterparty will see it once published: the header and terms card of the public
 * offer page, the sign form fields, then the notes only the editor sees.
 */
export function OfferFullPreview({
  state,
  author,
  titleAs = 'h2',
  layout = 'stacked',
}: OfferFullPreviewProps) {
  const { t } = useI18n();
  const priceLabel = useOfferPriceLabel();
  const { kind, fields, legalText } = state;
  const terms = getOfferTerms(fields);
  const commercial = parseOfferCommercialSummary(terms);
  const title = fields.name?.trim() || t('business_draft_untitled');
  const description = fields.description?.trim() || null;
  const tags = fields.tags ?? [];
  const serviceRef = fields.serviceRef?.trim() || null;
  const legalRef = fields.legalRef?.trim() || null;
  const billingNotes = fields.billingNotes?.trim() || null;
  const draftNotes = legalText.trim() || null;
  const TitleTag = titleAs;

  const signRows: BusinessDetailRow[] = (terms.signParams ?? []).map(
    (param) => ({
      id: param.key,
      label: param.label.trim() || param.key,
      value: param.required
        ? t('business_sign_params_field_required')
        : t('business_review_checklist_optional'),
    }),
  );

  const noteRows: BusinessDetailRow[] = [];
  if (billingNotes) {
    noteRows.push({
      label: t('business_field_billing_notes'),
      value: <span className="whitespace-pre-wrap">{billingNotes}</span>,
      wide: true,
    });
  }
  if (draftNotes) {
    noteRows.push({
      label: t('business_field_legal_text'),
      value: <span className="whitespace-pre-wrap">{draftNotes}</span>,
      wide: true,
    });
  }

  const content = (
    <>
      <header className={businessCardClass()}>
        <div className="flex flex-wrap items-center gap-2 text-caption text-fg-secondary">
          <span>{t(`business_kind_label_${kind}`)}</span>
          <span aria-hidden>·</span>
          <span>{t('business_editor_draft_label')}</span>
        </div>
        <TitleTag
          className={`mt-2 text-section font-display font-weight-display leading-display text-heading ${BUSINESS_BREAK_TEXT}`}
        >
          {title}
        </TitleTag>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {author ? (
            <p className="inline-flex min-w-0 items-center gap-2 text-body-sm text-fg">
              <UserAvatar username={author} size={AUTHOR_AVATAR_SIZE} />
              <span className={BUSINESS_BREAK_TEXT}>@{author}</span>
            </p>
          ) : null}
          <p className="text-body font-weight-strong tabular-nums text-heading">
            {priceLabel(commercial)}
          </p>
        </div>
        {description ? (
          <p
            className={`mt-card-padding whitespace-pre-wrap text-body text-fg ${BUSINESS_BREAK_TEXT}`}
          >
            {description}
          </p>
        ) : null}
        {tags.length > 0 ? (
          <ul
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label={t('business_field_tags')}
          >
            {tags.map((tag) => (
              <li
                key={tag}
                className="max-w-full truncate rounded-pill bg-surface-control px-2 py-0.5 text-caption text-fg"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <OfferTermsSummary
        terms={terms}
        disputeRule={fields.disputeRule ?? 'client'}
        arbiter={fields.arbiter ?? null}
        serviceRef={serviceRef}
        legalRef={legalRef}
      />
      {legalRef ? <BusinessDisclosure variant="legal_ref_warning" /> : null}
      {noteRows.length > 0 ? (
        <BusinessDetailSection title={t('notes')} rows={noteRows} />
      ) : null}
    </>
  );

  const signing = (
    <>
      {signRows.length > 0 ? (
        <BusinessDetailSection
          title={t('business_sign_params_title')}
          rows={signRows}
        />
      ) : null}
      <BusinessDisclosure variant="immutable_version" />
    </>
  );

  if (layout === 'split') {
    return (
      <article className={SPLIT_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-card-padding">{content}</div>
        <aside className={SPLIT_ASIDE_CLASS}>{signing}</aside>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-card-padding">
      {content}
      {signing}
    </article>
  );
}
