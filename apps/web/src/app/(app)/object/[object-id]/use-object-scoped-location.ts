'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { isPathnameWithinObjectPage } from '@/shared/routes/object-page-path';

type ObjectScopedLocation = {
  pathname: string;
  searchParams: URLSearchParams;
};

/**
 * Pathname + search params of the object page, frozen while an intercepted overlay
 * (post modal at `/@account/permlink`) owns the URL. Without this, the object shell would
 * re-resolve its primary tab from the overlay URL and fall back to the default tab underneath.
 */
export function useObjectScopedLocation(objectId: string): ObjectScopedLocation {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isWithinObject = isPathnameWithinObjectPage(objectId, pathname);

  const [scoped, setScoped] = useState<ObjectScopedLocation>(() => ({
    pathname,
    searchParams: new URLSearchParams(searchParams.toString()),
  }));

  if (
    isWithinObject &&
    (scoped.pathname !== pathname || scoped.searchParams.toString() !== searchParams.toString())
  ) {
    const next = { pathname, searchParams: new URLSearchParams(searchParams.toString()) };
    setScoped(next);
    return next;
  }

  return scoped;
}
