import { Module } from '@nestjs/common';
import { ObjectsDomainModule } from '@opden-data-layer/objects-domain';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { AffiliateModule } from '../affiliate';
import { CategoryNavigationModule } from '../categories/category-navigation.module';
import { ObjectProjectionModule } from '../object-projection/object-projection.module';
import { GetUserFavoritesEndpoint } from './get-user-favorites.endpoint';
import { GetUserFavoritesTypesEndpoint } from './get-user-favorites-types.endpoint';
import { PostUserFavoritesMapEndpoint } from './post-user-favorites-map.endpoint';
import { UserFavoritesScopeResolver } from './user-favorites-scope.resolver';

@Module({
  imports: [
    RepositoriesModule,
    ObjectsDomainModule,
    ObjectProjectionModule,
    AffiliateModule,
    CategoryNavigationModule,
  ],
  providers: [
    UserFavoritesScopeResolver,
    GetUserFavoritesTypesEndpoint,
    GetUserFavoritesEndpoint,
    PostUserFavoritesMapEndpoint,
  ],
  exports: [
    UserFavoritesScopeResolver,
    GetUserFavoritesTypesEndpoint,
    GetUserFavoritesEndpoint,
    PostUserFavoritesMapEndpoint,
  ],
})
export class FavoritesModule {}
