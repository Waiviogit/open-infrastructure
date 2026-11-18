/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DrawerRegion } from './drawer-region';

const HEADER_BOTTOM_PX = 64;

function mountHeaderSlot(): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'app-header-sticky-slot';
  slot.getBoundingClientRect = () => ({ bottom: HEADER_BOTTOM_PX }) as DOMRect;
  document.body.appendChild(slot);
  return slot;
}

function overlayOf(dialog: HTMLElement): HTMLElement {
  const overlay = dialog.parentElement;
  if (!overlay) {
    throw new Error('drawer overlay missing');
  }
  return overlay;
}

describe('DrawerRegion', () => {
  afterEach(() => {
    document.querySelectorAll('.app-header-sticky-slot').forEach((el) => el.remove());
  });

  it('covers the full viewport by default', () => {
    mountHeaderSlot();
    render(
      <DrawerRegion open onClose={jest.fn()} ariaLabel="Menu">
        content
      </DrawerRegion>,
    );
    expect(overlayOf(screen.getByRole('dialog')).style.top).toBe('');
  });

  it('starts under the app header with belowHeader', () => {
    mountHeaderSlot();
    render(
      <DrawerRegion open onClose={jest.fn()} ariaLabel="Menu" belowHeader>
        content
      </DrawerRegion>,
    );
    expect(overlayOf(screen.getByRole('dialog')).style.top).toBe(`${HEADER_BOTTOM_PX}px`);
  });

  it('uses the wide panel width', () => {
    render(
      <DrawerRegion open onClose={jest.fn()} ariaLabel="Menu" size="wide">
        content
      </DrawerRegion>,
    );
    const { className } = screen.getByRole('dialog');
    expect(className).toContain('w-[min(17rem,85vw)]');
    expect(className).not.toContain('var(--shell-left-width)');
  });
});
