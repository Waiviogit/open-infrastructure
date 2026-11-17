'use client';

import { PinIcon } from '@/icons';
import { useI18n } from '@/i18n/providers/i18n-provider';

export type StoryPinButtonProps = {
  /** Post is in the object's pinned block. */
  pinned: boolean;
  /** The viewer pinned it (created the `pin` update or voted `for`). */
  viewerPinned: boolean;
  pending: boolean;
  loggedIn: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onRequireLogin: () => void;
};

/**
 * Pin toggle in the story header on an object's Posts tab (legacy `PinButton`):
 * outline — not pinned; grey filled — pinned by others; accent filled — the viewer's pin.
 */
export function StoryPinButton({
  pinned,
  viewerPinned,
  pending,
  loggedIn,
  onPin,
  onUnpin,
  onRequireLogin,
}: StoryPinButtonProps) {
  const { t } = useI18n();
  const label = t(viewerPinned ? 'object_post_menu_unpin' : 'object_post_menu_pin');
  const iconClass = viewerPinned
    ? 'text-accent fill-current'
    : pinned
      ? 'text-fg-tertiary fill-current'
      : 'text-fg-tertiary';

  function onClick() {
    if (!loggedIn) {
      onRequireLogin();
      return;
    }
    if (viewerPinned) {
      onUnpin();
    } else {
      onPin();
    }
  }

  return (
    <button
      type="button"
      className="inline-flex shrink-0 rounded-btn p-1 transition-colors hover:bg-surface-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
      disabled={pending}
      aria-pressed={viewerPinned}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <PinIcon size={20} className={iconClass} />
    </button>
  );
}
