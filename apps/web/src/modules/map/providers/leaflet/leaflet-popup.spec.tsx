/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import { Evented } from 'leaflet';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';

import { LeafletAppPopup } from './leaflet-popup';

type PopupHandlers = { add: () => void; remove: () => void };

/** `Evented` is abstract in Leaflet's types; a concrete subclass is a map that only fires events. */
class TestMap extends Evented {}

const map = new TestMap();
const popupInstance = { options: { autoPan: true } };
let popupHandlers: PopupHandlers | null = null;

jest.mock('react-leaflet', () => ({
  useMap: () => map,
  Popup: forwardRef(function MockPopup(
    props: { eventHandlers: PopupHandlers; children: ReactNode },
    ref,
  ) {
    useImperativeHandle(ref, () => popupInstance);
    popupHandlers = props.eventHandlers;
    return <div>{props.children}</div>;
  }),
}));

function openPopup() {
  act(() => popupHandlers?.add());
}

function closePopup() {
  act(() => popupHandlers?.remove());
}

describe('LeafletAppPopup auto-pan', () => {
  beforeEach(() => {
    popupInstance.options.autoPan = true;
    popupHandlers = null;
    render(<LeafletAppPopup>card</LeafletAppPopup>);
  });

  it('keeps auto-pan when the popup opens', () => {
    openPopup();
    expect(popupInstance.options.autoPan).toBe(true);
  });

  it.each(['dragstart', 'zoomstart'])('stops auto-pan on %s while open', (event) => {
    openPopup();
    map.fire(event);
    expect(popupInstance.options.autoPan).toBe(false);
  });

  it('restores auto-pan on close for the next open', () => {
    openPopup();
    map.fire('dragstart');
    closePopup();
    expect(popupInstance.options.autoPan).toBe(true);
  });

  it('ignores map gestures while the popup is closed', () => {
    map.fire('dragstart');
    expect(popupInstance.options.autoPan).toBe(true);
  });
});
