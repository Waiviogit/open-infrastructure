'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { CloseIcon } from '@/icons';

import { useModalScrollLock } from '../hooks/use-modal-scroll-lock';
import { MODAL_Z_INDEX_DEFAULT } from './modal-shell.constants';
import {
  focusableElementsIn,
  hasOpenPopupIn,
  isTopModal,
  popModal,
  pushModal,
} from './modal-shell-focus';

export type ModalShellVariant = 'dialog' | 'fullscreen' | 'sheet';

export type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: ModalShellVariant;
  zIndex?: number;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  closeOnBackdrop?: boolean;
  /** When false, Escape does not call onClose. Default true. */
  closeOnEscape?: boolean;
  /** Extra classes on the scrim layer (`post-modal-scrim` base). */
  scrimClassName?: string;
  /** Extra classes on the dialog panel (card or fullscreen surface). */
  panelClassName?: string;
  /** Dialog shell alignment; `start` for tall overlays (e.g. post intercept). */
  align?: 'center' | 'start';
  /** Max width utility for dialog variant (default `max-w-md`). */
  maxWidthClass?: string;
  /** When false, body uses `overflow-hidden` (fullscreen media layouts). Default: true for dialog, false for fullscreen. */
  scrollBody?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  /** Renders beside the panel on desktop (e.g. post modal action pills). */
  aside?: ReactNode;
};

export type ModalShellCloseButtonProps = {
  onClose: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function ModalShellCloseButton({
  onClose,
  disabled = false,
  ariaLabel = 'Close',
  className = '',
}: ModalShellCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClose}
      disabled={disabled}
      className={[
        'flex size-8 shrink-0 items-center justify-center rounded-circle text-fg-secondary hover:bg-surface-control hover:text-fg disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
    >
      <CloseIcon size={16} />
    </button>
  );
}

/**
 * Portaled overlay with enforced scroll architecture:
 * shell `overflow-hidden` → panel `flex flex-col` → single scroll body.
 *
 * Keyboard: opening moves focus into the dialog (the panel itself, unless a child already took it
 * with `autoFocus`), Tab / Shift+Tab cycle inside it, Escape closes the top-most dialog unless a
 * popup inside it is open, and closing returns focus to the element that opened it.
 */
export function ModalShell({
  open,
  onClose,
  children,
  variant = 'dialog',
  zIndex = MODAL_Z_INDEX_DEFAULT,
  labelledBy,
  describedBy,
  ariaLabel,
  closeOnBackdrop = true,
  closeOnEscape = true,
  scrimClassName = '',
  panelClassName = '',
  align = 'center',
  maxWidthClass = 'max-w-md',
  scrollBody,
  header,
  footer,
  aside,
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);
  const modalId = useId();
  /** Focus trap root: the dialog panel plus its optional desktop aside. */
  const trapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isFullscreen = variant === 'fullscreen';
  const isSheet = variant === 'sheet';
  const bodyScrolls = scrollBody ?? !isFullscreen;
  const visible = open && mounted;

  useModalScrollLock(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /** Stacking order for Escape, initial focus and focus return. */
  useEffect(() => {
    if (!visible) {
      return;
    }
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    pushModal(modalId);
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
    return () => {
      popModal(modalId);
      if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [visible, modalId]);

  /**
   * Window bubble phase: popups inside the dialog (selects, menus, comboboxes) handle Escape first
   * on their own element or `document`; the dialog closes on a later Escape.
   */
  useEffect(() => {
    if (!visible || !closeOnEscape) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) {
        return;
      }
      if (!isTopModal(modalId) || hasOpenPopupIn(trapRef.current)) {
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, closeOnEscape, modalId]);

  /** Keeps keyboard focus inside the dialog; other keys stay local to it (no page shortcuts). */
  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      return;
    }
    e.stopPropagation();
    if (e.key !== 'Tab') {
      return;
    }
    const root = trapRef.current;
    if (!root) {
      return;
    }
    const focusables = focusableElementsIn(root);
    if (focusables.length === 0) {
      e.preventDefault();
      panelRef.current?.focus({ preventScroll: true });
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!visible || typeof document === 'undefined') {
    return null;
  }

  const shellAlign =
    align === 'start'
      ? 'items-start justify-center py-8'
      : 'items-center justify-center';

  const panelBase = isFullscreen
    ? 'h-dvh max-h-dvh w-full flex flex-col overflow-hidden overscroll-none'
    : isSheet
      ? 'mt-auto flex w-full max-h-[92dvh] flex-col overflow-hidden rounded-t-card border border-border bg-surface shadow-card-float'
      : [
          'w-full flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card-float',
          maxWidthClass,
        ].join(' ');

  const bodyClass = bodyScrolls
    ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
    : 'flex min-h-0 flex-1 flex-col overflow-hidden';

  const dialogContent = (
    <>
      <div
        className={['post-modal-scrim fixed inset-0', scrimClassName].join(' ')}
        style={{ zIndex }}
        aria-hidden
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={[
          'pointer-events-none fixed inset-0 overflow-hidden',
          isFullscreen
            ? 'flex flex-col'
            : isSheet
              ? 'flex flex-col justify-end'
              : `flex p-4 ${shellAlign}`,
        ].join(' ')}
        style={{ zIndex }}
        role="presentation"
      >
        <div
          ref={trapRef}
          className={[
            'pointer-events-auto min-w-0',
            isFullscreen
              ? 'flex h-full min-h-0 flex-1 flex-col'
              : isSheet
                ? 'flex w-full flex-col'
                : aside
                  ? 'flex w-full max-w-container-post items-start gap-3'
                  : `flex w-full justify-center`,
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handlePanelKeyDown}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            aria-label={ariaLabel}
            tabIndex={-1}
            className={[
              panelBase,
              'outline-none',
              panelClassName,
              !isFullscreen && aside ? 'min-w-0 flex-1' : '',
            ].join(' ')}
          >
            {header ? <div className="shrink-0">{header}</div> : null}
            <div className={bodyClass}>{children}</div>
            {footer ? <div className="shrink-0">{footer}</div> : null}
          </div>
          {aside ? (
            <div
              className="hidden shrink-0 flex-col gap-2 lg:flex"
              onClick={(e) => e.stopPropagation()}
            >
              {aside}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
}
