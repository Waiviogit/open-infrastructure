import { OBJECT_TYPE_REGISTRY } from '@opden-data-layer/core/object-type-registry';

import { DEFAULT_DISCOVER_OBJECT_TYPE } from './discover-registry';
import { buildDiscoverHref, parseDiscoverPageState } from './discover-url';

export type ResolveInitialDiscoverTypeInput = {
  objectType: string | null;
  usersMode: boolean;
  remembered: string | null;
};

export type ResolveInitialDiscoverTypeResult =
  | { action: 'navigate'; type: string }
  | { action: 'none' };

function isValidRegistryObjectType(type: string): boolean {
  return type in OBJECT_TYPE_REGISTRY;
}

/** Decide how to handle bare `/discover` (no type, not users mode). */
export function resolveInitialDiscoverType(
  input: ResolveInitialDiscoverTypeInput,
): ResolveInitialDiscoverTypeResult {
  if (input.usersMode || input.objectType != null) {
    return { action: 'none' };
  }

  const remembered = input.remembered?.trim();
  if (remembered && isValidRegistryObjectType(remembered)) {
    return { action: 'navigate', type: remembered };
  }

  return { action: 'navigate', type: DEFAULT_DISCOVER_OBJECT_TYPE };
}

/**
 * Redirect target for a bare `/discover` request (no `type`, not users mode), keeping the other
 * filters; `null` when the URL already selects a type. Used by `proxy.ts` so the 307 happens
 * before rendering.
 */
export function resolveBareDiscoverRedirectHref(
  searchParams: URLSearchParams,
  remembered: string | null,
): string | null {
  const state = parseDiscoverPageState(searchParams);
  const resolution = resolveInitialDiscoverType({
    objectType: state.objectType,
    usersMode: state.usersMode,
    remembered,
  });
  if (resolution.action === 'none') {
    return null;
  }
  return buildDiscoverHref({
    type: resolution.type,
    q: state.q,
    tags: state.tags,
    sort: state.sort,
    box: state.box,
    map: state.map,
  });
}
