import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { RedisClientFactory } from '@opden-data-layer/clients';

import { DISCOVER_CATEGORIES_CACHE_TTL_SEC } from '../../constants/discover.constants';
import { redisKey } from '../../constants/redis-keys';
import { CategoryNavigationService } from '../categories/category-navigation.service';
import type { DiscoverCategoriesQuery } from './discover-query.schema';
import type { DiscoverCategoriesResponseDto } from './discover.types';
import { parseTagFilters } from './get-discover-objects.endpoint';

export interface GetDiscoverCategoriesInput {
  query: DiscoverCategoriesQuery;
}

function lineageHash(lineage: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(lineage)).digest('hex');
}

/**
 * One level of the Discover category tree for a type: children of `category_path` over every
 * active object of the type, narrowed by search / tags / map area, counted in groups. Uses the
 * shared category navigation (client display rules, near-duplicates). The unfiltered level is
 * cached in Redis; a filtered one is always computed.
 * @see docs/apps/query-api/spec/discover-categories.md
 */
@Injectable()
export class GetDiscoverCategoriesEndpoint {
  private readonly logger = new Logger(GetDiscoverCategoriesEndpoint.name);

  constructor(
    private readonly navigation: CategoryNavigationService,
    private readonly redisFactory: RedisClientFactory,
  ) {}

  async execute(input: GetDiscoverCategoriesInput): Promise<DiscoverCategoriesResponseDto> {
    const objectType = input.query.object_type.trim();
    const lineage = input.query.category_path;
    const q = input.query.q?.trim() ?? '';
    const tags = parseTagFilters(input.query.tags);
    const box = input.query.box ?? null;
    const cacheable = q.length === 0 && tags.length === 0 && box == null;
    const key = redisKey.discoverCategories(objectType, lineageHash(lineage));

    if (cacheable) {
      const cached = await this.readCache(key);
      if (cached) {
        return cached;
      }
    }

    const nav = await this.navigation.build({
      scope: { kind: 'type', objectType, q, tags, box },
      objectType,
      lineage,
      excluded: [],
      includeHasChildren: true,
    });
    const response: DiscoverCategoriesResponseDto = {
      items: nav.items,
      show_other: nav.show_other,
    };

    if (cacheable) {
      await this.writeCache(key, response);
    }
    return response;
  }

  private async readCache(key: string): Promise<DiscoverCategoriesResponseDto | null> {
    try {
      const raw = await this.redisFactory.getClient().get(key);
      return raw ? (JSON.parse(raw) as DiscoverCategoriesResponseDto) : null;
    } catch (e) {
      this.logger.warn(`discover categories cache read failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async writeCache(key: string, response: DiscoverCategoriesResponseDto): Promise<void> {
    try {
      await this.redisFactory
        .getClient()
        .set(key, JSON.stringify(response), DISCOVER_CATEGORIES_CACHE_TTL_SEC);
    } catch (e) {
      this.logger.warn(`discover categories cache write failed: ${(e as Error).message}`);
    }
  }
}
