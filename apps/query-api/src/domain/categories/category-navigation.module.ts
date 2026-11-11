import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { UserCategoryNavigationService } from './user-category-navigation.service';

/**
 * Category navigation on its own so both `CategoriesModule` and `FavoritesModule`
 * (`favorites/types` needs it) can import it without a module cycle.
 */
@Module({
  imports: [RepositoriesModule],
  providers: [UserCategoryNavigationService],
  exports: [UserCategoryNavigationService],
})
export class CategoryNavigationModule {}
