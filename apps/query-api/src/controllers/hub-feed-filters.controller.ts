import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import {
  GetUserFeedFilterObjectsEndpoint,
  GetUserFeedFilterUsersEndpoint,
  GetUserFeedFiltersEndpoint,
  hubFeedFilterObjectsQuerySchema,
  hubFeedFiltersQuerySchema,
  hubFeedFilterUsersQuerySchema,
  type HubFeedFilterObjectsPageDto,
  type HubFeedFilterObjectsQuery,
  type HubFeedFiltersDto,
  type HubFeedFiltersQuery,
  type HubFeedFilterUsersPageDto,
  type HubFeedFilterUsersQuery,
} from '../domain/hub-feed';
import { ReqGovernanceObjectId } from '../http/governance-object-id.decorator';
import { ReqLocale } from '../http/locale-header.decorator';
import { ReqViewer } from '../http/viewer-header.decorator';
import { ZodQueryPipe } from '../pipes';

function orNotFound<T>(result: T | null, name: string): T {
  if (!result) {
    throw new NotFoundException(`User not found: ${name}`);
  }
  return result;
}

/**
 * Hub rail for an account: followed accounts and objects with new items in the last 3 days.
 * @see docs/apps/query-api/spec/hub-feed-filters.md
 */
@Controller({ path: 'users', version: '1' })
export class HubFeedFiltersController {
  constructor(
    private readonly getUserFeedFilters: GetUserFeedFiltersEndpoint,
    private readonly getUserFeedFilterUsers: GetUserFeedFilterUsersEndpoint,
    private readonly getUserFeedFilterObjects: GetUserFeedFilterObjectsEndpoint,
  ) {}

  @Get(':name/feed-filters')
  async summary(
    @Param('name') name: string,
    @Query(new ZodQueryPipe(hubFeedFiltersQuerySchema)) query: HubFeedFiltersQuery,
    @ReqLocale() locale: string,
    @ReqGovernanceObjectId() governanceObjectIdFromHeader: string | undefined,
    @ReqViewer() viewerAccount: string | undefined,
  ): Promise<HubFeedFiltersDto> {
    const result = await this.getUserFeedFilters.execute(name, query, {
      locale,
      governanceObjectIdFromHeader,
      viewerAccount,
    });
    return orNotFound(result, name);
  }

  @Get(':name/feed-filters/users')
  async users(
    @Param('name') name: string,
    @Query(new ZodQueryPipe(hubFeedFilterUsersQuerySchema)) query: HubFeedFilterUsersQuery,
  ): Promise<HubFeedFilterUsersPageDto> {
    return orNotFound(await this.getUserFeedFilterUsers.execute(name, query), name);
  }

  @Get(':name/feed-filters/objects')
  async objects(
    @Param('name') name: string,
    @Query(new ZodQueryPipe(hubFeedFilterObjectsQuerySchema)) query: HubFeedFilterObjectsQuery,
    @ReqLocale() locale: string,
    @ReqGovernanceObjectId() governanceObjectIdFromHeader: string | undefined,
    @ReqViewer() viewerAccount: string | undefined,
  ): Promise<HubFeedFilterObjectsPageDto> {
    const result = await this.getUserFeedFilterObjects.execute(name, query, {
      locale,
      governanceObjectIdFromHeader,
      viewerAccount,
    });
    return orNotFound(result, name);
  }
}
