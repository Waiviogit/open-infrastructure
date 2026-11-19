/**
 * Class recipes for Market (`/business`) controls. One recipe per role so every screen shares
 * hover, focus, disabled and touch-target behaviour. Tokens only (see `apps/web/AGENTS.md`).
 */

/** App-wide keyboard focus ring (same classes as the rest of `apps/web`). */
export const BUSINESS_FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export type BusinessButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive';
export type BusinessButtonSize = 'md' | 'sm';

const BUTTON_BASE = [
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-btn text-body-sm font-weight-label',
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  BUSINESS_FOCUS_RING,
].join(' ');

/** Heights: 40px (`md`) / 36px (`sm`); both grow to 44px below `lg` for touch. */
const BUTTON_SIZE: Record<BusinessButtonSize, string> = {
  md: 'min-h-10 px-4 py-2 max-lg:min-h-11',
  sm: 'min-h-9 px-3 py-1.5 max-lg:min-h-11',
};

const BUTTON_VARIANT: Record<BusinessButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary:
    'border border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-alt',
  ghost: 'text-link hover:bg-ghost-surface',
  destructive:
    'border border-error bg-surface text-error hover:bg-error hover:text-error-fg',
};

export function businessButtonClass({
  variant = 'secondary',
  size = 'md',
  className = '',
}: {
  variant?: BusinessButtonVariant;
  size?: BusinessButtonSize;
  className?: string;
} = {}): string {
  return [BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className]
    .filter(Boolean)
    .join(' ');
}

/** Text inputs, selects and textareas. `aria-invalid` switches the border to the error colour. */
export const BUSINESS_FIELD_CLASS = [
  'w-full min-w-0 rounded-btn border border-border bg-surface-control px-3 py-2 text-body text-fg',
  'placeholder:text-fg-tertiary transition-colors hover:border-border-strong',
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-error',
  BUSINESS_FOCUS_RING,
].join(' ');

/** Card surface shared with Feed / Discover story cards. */
const CARD_BASE =
  'min-w-0 rounded-card border border-border bg-surface p-3 shadow-whisper sm:p-card-padding';

/** A card that is itself the link / button target. */
const CARD_INTERACTIVE = [
  'block transition-colors hover:border-border-strong',
  BUSINESS_FOCUS_RING,
].join(' ');

export function businessCardClass({
  interactive = false,
  className = '',
}: { interactive?: boolean; className?: string } = {}): string {
  return [CARD_BASE, interactive ? CARD_INTERACTIVE : '', className]
    .filter(Boolean)
    .join(' ');
}

/** Quiet inline callout (disclosures, hints) inside a card or form. */
export const BUSINESS_CALLOUT_CLASS =
  'rounded-card border border-border bg-surface-control px-3 py-2 text-body-sm text-fg';

/** Long user-supplied text (titles, account names, ids) must never overflow its card. */
export const BUSINESS_BREAK_TEXT =
  'min-w-0 break-words [overflow-wrap:anywhere]';
