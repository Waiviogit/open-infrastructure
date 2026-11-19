/**
 * Keyboard helpers for `ModalShell`: the open-dialog stack (Escape closes only the top one),
 * focusable lookup for the Tab trap, and open-popup detection so Escape reaches a menu first.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Selects, menus and comboboxes announce an open popup with `aria-expanded="true"`. */
const OPEN_POPUP_SELECTOR = '[aria-expanded="true"]';

const openModals: string[] = [];

export function pushModal(id: string): void {
  popModal(id);
  openModals.push(id);
}

export function popModal(id: string): void {
  const index = openModals.lastIndexOf(id);
  if (index !== -1) {
    openModals.splice(index, 1);
  }
}

export function isTopModal(id: string): boolean {
  return openModals[openModals.length - 1] === id;
}

function isRendered(element: HTMLElement): boolean {
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility();
  }
  return element.getClientRects().length > 0;
}

/** Tabbable elements in DOM order; hidden ones (`display: none`, collapsed) are skipped. */
export function focusableElementsIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.closest('[inert]') && isRendered(element));
}

export function hasOpenPopupIn(root: HTMLElement | null): boolean {
  return Boolean(root?.querySelector(OPEN_POPUP_SELECTOR));
}
