'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useEffectiveNav } from '@/shared/presentation';

/** Label of the filter the rail shows as active, tied to the URL it was computed for. */
type ActiveFilterLabelEntry = { navKey: string; label: string };

type ActiveFilterLabelContextValue = {
  entry: ActiveFilterLabelEntry | null;
  setEntry: (entry: ActiveFilterLabelEntry) => void;
};

const ActiveFilterLabelContext = createContext<ActiveFilterLabelContextValue | null>(null);

function useNavKey(): string {
  const { pathname, search } = useEffectiveNav();
  return `${pathname}?${search}`;
}

/**
 * Shares the rail's active filter name with the mobile drawer trigger, which sits outside
 * the rail. Only the rail resolves it: it knows the session default, the tab's supported
 * sorts and followed object names.
 */
export function HomeFeedActiveFilterLabelProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<ActiveFilterLabelEntry | null>(null);
  const value = useMemo(() => ({ entry, setEntry }), [entry]);
  return <ActiveFilterLabelContext.Provider value={value}>{children}</ActiveFilterLabelContext.Provider>;
}

/** Rail side: publish the active filter label for the current URL. */
export function useReportHomeFeedActiveFilterLabel(label: string): void {
  const context = useContext(ActiveFilterLabelContext);
  const navKey = useNavKey();
  const setEntry = context?.setEntry;
  useEffect(() => {
    setEntry?.({ navKey, label });
  }, [setEntry, navKey, label]);
}

/**
 * Trigger side: the rail's label for the current URL, or `null` while the rail for this
 * URL has not rendered yet (it streams in its own Suspense boundary).
 */
export function useHomeFeedActiveFilterLabel(): string | null {
  const context = useContext(ActiveFilterLabelContext);
  const navKey = useNavKey();
  const entry = context?.entry;
  return entry && entry.navKey === navKey ? entry.label : null;
}
