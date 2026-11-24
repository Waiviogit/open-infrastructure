import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { CategoryNavigationService } from './category-navigation.service';

/**
 * Category navigation on its own so both `CategoriesModule` and `FavoritesModule`
 * (`favorites/types` needs it) can import it without a module cycle.
 */
@Module({
  imports: [RepositoriesModule],
  providers: [CategoryNavigationService],
  exports: [CategoryNavigationService],
})
export class CategoryNavigationModule {}
