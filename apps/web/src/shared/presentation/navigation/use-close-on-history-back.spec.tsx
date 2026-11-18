/**
 * @jest-environment jsdom
 */
import { act, render, waitFor } from '@testing-library/react';
import { useState } from 'react';

import { useCloseOnHistoryBack } from './use-close-on-history-back';

let mockPathname = '/@alice/favorites/recipe';

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const NEXT_STATE = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: 'tree' };

let setOpenFromTest: (open: boolean) => void = () => undefined;

function Overlay({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  setOpenFromTest = setOpen;
  useCloseOnHistoryBack(open, () => {
    setOpen(false);
    onClose();
  });
  return <p>{open ? 'open' : 'closed'}</p>;
}

function popTo(state: unknown) {
  act(() => {
    window.history.replaceState(state, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  });
}

describe('useCloseOnHistoryBack', () => {
  beforeEach(() => {
    mockPathname = '/@alice/favorites/recipe';
    window.history.replaceState(NEXT_STATE, '', mockPathname);
    window.scrollTo = jest.fn();
  });

  it('pushes a same-URL entry that keeps Next state and drops the saved list scroll', () => {
    window.history.replaceState({ ...NEXT_STATE, __odlScrollY: 900 }, '');
    const lengthBefore = window.history.length;
    render(<Overlay onClose={jest.fn()} />);
    act(() => setOpenFromTest(true));

    expect(window.history.length).toBe(lengthBefore + 1);
    expect(window.location.pathname).toBe('/@alice/favorites/recipe');
    const state = window.history.state as Record<string, unknown>;
    expect(state.__NA).toBe(true);
    expect(state.__odlScrollY).toBeUndefined();
    expect(typeof state.__odlOverlay).toBe('string');
  });

  it('closes on Back, when the overlay entry is popped', () => {
    const onClose = jest.fn();
    render(<Overlay onClose={onClose} />);
    act(() => setOpenFromTest(true));

    popTo(NEXT_STATE);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pops its entry when closed another way', async () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<Overlay onClose={jest.fn()} />);
    act(() => setOpenFromTest(true));
    act(() => setOpenFromTest(false));

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    back.mockRestore();
  });

  it('leaves history alone when a link inside replaced its entry and closed it', () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    render(<Overlay onClose={jest.fn()} />);
    act(() => setOpenFromTest(true));

    act(() => {
      // replaceInstantUrl copies the current state (marker included) onto the new URL.
      window.history.replaceState(window.history.state, '', '/@alice/favorites/recipe/Desserts');
      setOpenFromTest(false);
    });
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it('pushes a fresh entry when it stays open across a navigation', () => {
    const { rerender } = render(<Overlay onClose={jest.fn()} />);
    act(() => setOpenFromTest(true));
    const lengthOpen = window.history.length;

    act(() => {
      window.history.replaceState(NEXT_STATE, '', '/@alice/favorites/recipe/German%20Cuisine');
      mockPathname = '/@alice/favorites/recipe/German%20Cuisine';
    });
    rerender(<Overlay onClose={jest.fn()} />);

    expect(window.history.length).toBe(lengthOpen + 1);
    expect((window.history.state as Record<string, unknown>).__odlOverlay).toBeDefined();
  });
});
