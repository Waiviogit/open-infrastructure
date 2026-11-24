import { Controller, Get, Query } from '@nestjs/common';
import {
  GetDiscoverCategoriesEndpoint,
  GetDiscoverObjectsEndpoint,
  GetDiscoverSectionsEndpoint,
  GetDiscoverTagCategoriesEndpoint,
  GetDiscoverUsersEndpoint,
  discoverCategoriesQuerySchema,
  discoverObjectsQuerySchema,
  discoverSectionsQuerySchema,
  discoverTagCategoriesQuerySchema,
  discoverUsersQuerySchema,
  type DiscoverCategoriesQuery,
  type DiscoverCategoriesResponseDto,
  type DiscoverObjectsQuery,
  type DiscoverObjectsResponseDto,
  type DiscoverSectionsQuery,
  type DiscoverSectionsResponseDto,
  type DiscoverTagCategoriesQuery,
  type DiscoverTagCategoriesResponseDto,
  type DiscoverUsersQuery,
  type DiscoverUsersResponseDto,
} from '../domain/discover';
import { CountryResolverService } from '../domain/geoip';
import { ReqClientIp } from '../http/client-ip.decorator';
import { ReqGovernanceObjectId } from '../http/governance-object-id.decorator';
import { ReqLocale } from '../http/locale-header.decorator';
import { ReqViewer } from '../http/viewer-header.decorator';
import { ZodQueryPipe } from '../pipes';

@Controller({ path: 'discover', version: ['1', '2'] })
export class DiscoverController {
  constructor(
    private readonly getDiscoverObjects: GetDiscoverObjectsEndpoint,
    private readonly getDiscoverUsers: GetDiscoverUsersEndpoint,
    private readonly getDiscoverTagCategories: GetDiscoverTagCategoriesEndpoint,
    private readonly getDiscoverCategories: GetDiscoverCategoriesEndpoint,
    private readonly getDiscoverSections: GetDiscoverSectionsEndpoint,
    private readonly countryResolver: CountryResolverService,
  ) {}

  @Get('objects')
  async objects(
    @Query(new ZodQueryPipe(discoverObjectsQuerySchema)) query: DiscoverObjectsQuery,
    @ReqLocale() locale: string,
    @ReqViewer() viewer: string | undefined,
    @ReqGovernanceObjectId() governanceObjectIdFromHeader: string | undefined,
    @ReqClientIp() clientIp: string | null,
  ): Promise<DiscoverObjectsResponseDto> {
    return this.getDiscoverObjects.execute({
      query,
      locale,
      viewerAccount: viewer,
      governanceObjectIdFromHeader,
      countryCode: this.countryResolver.resolve(clientIp, query.country),
    });
  }

  @Get('users')
  async users(
    @Query(new ZodQueryPipe(discoverUsersQuerySchema)) query: DiscoverUsersQuery,
    @ReqViewer() viewer: string | undefined,
  ): Promise<DiscoverUsersResponseDto> {
    return this.getDiscoverUsers.execute({ query, viewerAccount: viewer });
  }

  @Get('tag-categories')
  async tagCategories(
    @Query(new ZodQueryPipe(discoverTagCategoriesQuerySchema)) query: DiscoverTagCategoriesQuery,
  ): Promise<DiscoverTagCategoriesResponseDto> {
    return this.getDiscoverTagCategories.execute({ query });
  }

  @Get('categories')
  async categories(
    @Query(new ZodQueryPipe(discoverCategoriesQuerySchema)) query: DiscoverCategoriesQuery,
  ): Promise<DiscoverCategoriesResponseDto> {
    return this.getDiscoverCategories.execute({ query });
  }

  @Get('sections')
  async sections(
    @Query(new ZodQueryPipe(discoverSectionsQuerySchema)) query: DiscoverSectionsQuery,
    @ReqLocale() locale: string,
    @ReqViewer() viewer: string | undefined,
    @ReqGovernanceObjectId() governanceObjectIdFromHeader: string | undefined,
    @ReqClientIp() clientIp: string | null,
  ): Promise<DiscoverSectionsResponseDto> {
    return this.getDiscoverSections.execute({
      query,
      locale,
      viewerAccount: viewer,
      governanceObjectIdFromHeader,
      countryCode: this.countryResolver.resolve(clientIp, query.country),
    });
  }
}
