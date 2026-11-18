'use client';

import type { Popup as LeafletPopup } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Popup, useMap } from 'react-leaflet';

import '../../map-leaflet-popup.css';

import type { AppPopupProps } from '../../types';

/** Map gestures that mean the user is moving the map away from an open popup. */
const USER_MAP_MOVE_EVENTS = 'dragstart zoomstart';

/**
 * Leaflet pans the map back to the popup on every `update()`, and react-leaflet
 * calls `update()` on each re-render of the popup content. A map screen that
 * re-renders on `moveend` therefore snaps back after every drag. The popup keeps
 * auto-pan while it opens, drops it once the user drags or zooms, and gets it
 * back on close for the next open.
 */
export function LeafletAppPopup({
  children,
  className,
  maxWidth = 320,
  minWidth = 260,
}: AppPopupProps) {
  const map = useMap();
  const popupRef = useRef<LeafletPopup | null>(null);
  const [open, setOpen] = useState(false);

  const eventHandlers = useMemo(
    () => ({
      add: () => setOpen(true),
      remove: () => setOpen(false),
    }),
    [],
  );

  useEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup) {
      return;
    }
    const stopAutoPan = () => {
      popup.options.autoPan = false;
    };
    map.on(USER_MAP_MOVE_EVENTS, stopAutoPan);
    return () => {
      map.off(USER_MAP_MOVE_EVENTS, stopAutoPan);
      popup.options.autoPan = true;
    };
  }, [map, open]);

  return (
    <Popup
      ref={popupRef}
      className={className}
      maxWidth={maxWidth}
      minWidth={minWidth}
      eventHandlers={eventHandlers}
    >
      {children}
    </Popup>
  );
}
