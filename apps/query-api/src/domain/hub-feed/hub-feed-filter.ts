/** Hub start page tabs. */
export const HUB_FEED_TABS = ['posts', 'threads', 'activity', 'updates'] as const;
export type HubFeedTab = (typeof HUB_FEED_TABS)[number];

/** Site-wide sorts of the rail's first section. */
export const HUB_FEED_SORTS = ['trending', 'hot', 'new'] as const;
export type HubFeedSort = (typeof HUB_FEED_SORTS)[number];

/** Sorts each tab supports (Activity has no votes or comments; Updates has no comments). */
export const HUB_FEED_TAB_SORTS: Readonly<Record<HubFeedTab, readonly HubFeedSort[]>> = {
  posts: ['trending', 'hot', 'new'],
  threads: ['trending', 'hot', 'new'],
  activity: ['new'],
  updates: ['trending', 'new'],
};

/** Exactly one rail item is active; every tab reads the same filter. */
export type HubFeedFilter =
  | { kind: HubFeedSort }
  | { kind: 'my' }
  | { kind: 'author'; account: string }
  | { kind: 'object'; object_id: string };

/** Canonical string for a filter; cursors carry it so a page never continues another filter. */
export function hubFeedFilterKey(filter: HubFeedFilter): string {
  switch (filter.kind) {
    case 'author':
      return `author:${filter.account}`;
    case 'object':
      return `object:${filter.object_id}`;
    default:
      return filter.kind;
  }
}

export function assertNeverHubFeedFilter(filter: never): never {
  throw new Error(`Unhandled hub feed filter: ${JSON.stringify(filter)}`);
}
