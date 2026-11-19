/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { ModalShell } from './modal-shell';

jest.mock('../hooks/use-modal-scroll-lock', () => ({
  useModalScrollLock: jest.fn(),
}));

describe('ModalShell variants', () => {
  it('renders dialog variant with centered max-width panel', () => {
    render(
      <ModalShell open onClose={jest.fn()} variant="dialog" maxWidthClass="max-w-md">
        <p>Dialog body</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-md');
    expect(dialog.className).toContain('rounded-card');
    expect(dialog.className).not.toContain('h-dvh');
    expect(dialog.className).not.toContain('rounded-t-card');
  });

  it('renders fullscreen variant as full-height panel', () => {
    render(
      <ModalShell open onClose={jest.fn()} variant="fullscreen">
        <p>Fullscreen body</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('h-dvh');
    expect(dialog.className).not.toContain('rounded-t-card');
  });

  it('renders sheet variant as bottom sheet panel', () => {
    render(
      <ModalShell open onClose={jest.fn()} variant="sheet">
        <p>Sheet body</p>
      </ModalShell>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('rounded-t-card');
    expect(dialog.className).toContain('max-h-[92dvh]');
    expect(dialog.className).not.toContain('max-w-md');
  });
});

describe('ModalShell keyboard', () => {
  beforeAll(() => {
    // jsdom has no layout: treat every element as rendered for the Tab trap.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value: () => true,
    });
  });

  function Example({
    onClose,
    closeOnEscape,
    children,
  }: {
    onClose?: () => void;
    closeOnEscape?: boolean;
    children?: ReactNode;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ModalShell
          open={open}
          ariaLabel="Example"
          closeOnEscape={closeOnEscape}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
        >
          {children ?? (
            <>
              <button type="button">First</button>
              <input aria-label="Name" />
              <button type="button">Last</button>
            </>
          )}
        </ModalShell>
      </>
    );
  }

  function openFromTrigger(): HTMLElement {
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it('moves focus into the dialog when it opens', () => {
    render(<Example />);
    openFromTrigger();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('keeps focus on a child that took it with autoFocus', () => {
    render(
      <Example>
        <input aria-label="Auto" autoFocus />
      </Example>,
    );
    openFromTrigger();
    expect(screen.getByRole('textbox', { name: 'Auto' })).toHaveFocus();
  });

  it('closes on Escape from inside the dialog and returns focus to the trigger', () => {
    const onClose = jest.fn();
    render(<Example onClose={onClose} />);
    const trigger = openFromTrigger();
    const name = screen.getByRole('textbox', { name: 'Name' });
    name.focus();
    fireEvent.keyDown(name, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('leaves Escape to an open popup inside the dialog', () => {
    const onClose = jest.fn();
    render(
      <Example onClose={onClose}>
        <button type="button" aria-expanded="true">
          Menu
        </button>
      </Example>,
    );
    openFromTrigger();
    const menu = screen.getByRole('button', { name: 'Menu' });
    menu.focus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape when closeOnEscape is false', () => {
    const onClose = jest.fn();
    render(<Example onClose={onClose} closeOnEscape={false} />);
    openFromTrigger();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cycles Tab and Shift+Tab inside the dialog', () => {
    render(<Example />);
    openFromTrigger();
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('closes only the top-most dialog on Escape', () => {
    const closeBottom = jest.fn();
    const closeTop = jest.fn();
    render(
      <>
        <ModalShell open onClose={closeBottom} ariaLabel="Bottom">
          <button type="button">Bottom action</button>
        </ModalShell>
        <ModalShell open onClose={closeTop} ariaLabel="Top">
          <button type="button">Top action</button>
        </ModalShell>
      </>,
    );
    const topAction = screen.getByRole('button', { name: 'Top action' });
    topAction.focus();
    fireEvent.keyDown(topAction, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
  });
});
