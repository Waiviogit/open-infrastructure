import { Injectable } from '@nestjs/common';

import { HubFeedPresenceRepository } from '../../repositories';
import { HUB_FEED_TABS, type HubFeedTab } from './hub-feed-filter';
import type { HubFeedPresenceQuery } from './schemas/hub-feed-filters.schema';

export interface HubFeedPresenceDto {
  /** Hub tabs with at least one item of the account / object, in tab order. */
  tabs: HubFeedTab[];
}

/**
 * Where an author / object filter can be applied: the web keeps the filter when switching
 * to a tab listed here and falls back to the tab default otherwise.
 * @see docs/apps/query-api/spec/hub-feed.md
 */
@Injectable()
export class GetHubFeedPresenceEndpoint {
  constructor(private readonly presenceRepo: HubFeedPresenceRepository) {}

  async execute(query: HubFeedPresenceQuery): Promise<HubFeedPresenceDto> {
    const tabs = query.author
      ? await this.presenceRepo.findTabs('user', query.author)
      : await this.presenceRepo.findTabs('object', query.object ?? '');
    const present = new Set(tabs ?? []);
    return { tabs: HUB_FEED_TABS.filter((tab) => present.has(tab)) };
  }
}
