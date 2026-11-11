import { Injectable } from '@nestjs/common';
import { ObjectCategoriesRepository } from '../../repositories';
import { UserFavoritesScopeResolver } from '../favorites/user-favorites-scope.resolver';
import type { UserCategoriesQuery, UserCategoriesResponse } from './categories-query.schema';
import { UserCategoryNavigationService } from './user-category-navigation.service';

const EMPTY_RESPONSE: UserCategoriesResponse = {
  items: [],
  uncategorized_count: 0,
  show_other: false,
};

@Injectable()
export class GetUserCategoriesEndpoint {
  constructor(
    private readonly scopeResolver: UserFavoritesScopeResolver,
    private readonly navigation: UserCategoryNavigationService,
    private readonly objectCategoriesRepo: ObjectCategoriesRepository,
  ) {}

  async execute(username: string, query: UserCategoriesQuery): Promise<UserCategoriesResponse> {
    const account = username.trim();
    const objectType = query.types[0];
    if (account.length === 0 || objectType == null) {
      return { ...EMPTY_RESPONSE };
    }

    const scope = await this.scopeResolver.resolve(account, [objectType]);
    if (scope.types.length === 0) {
      return { ...EMPTY_RESPONSE };
    }

    const nameSegment = query.name?.trim() ?? '';
    const lineage = nameSegment.length > 0 ? [...(query.path ?? []), nameSegment] : [];
    const isRoot = lineage.length === 0;

    const [nav, uncategorizedCount] = await Promise.all([
      this.navigation.build({
        scope,
        objectType,
        lineage,
        excluded: query.excluded ?? [],
        includeHasChildren: true,
      }),
      isRoot
        ? this.objectCategoriesRepo.countUncategorizedObjectIdsByScope({ scope })
        : Promise.resolve(0),
    ]);

    return {
      items: nav.items,
      uncategorized_count: uncategorizedCount,
      show_other: nav.show_other,
    };
  }
}
