import {
  objectTypeSupportsCategories,
  parseUserCategoryScopeKey,
  resolvePostLinkedObjectTypes,
} from '@opden-data-layer/core';

import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import type { Transaction } from 'kysely';

import type { CategoryScopeRepository } from './category-scope.repository';
import { GLOBAL_CATEGORY_SCOPE_KEY } from './category-scope.constants';
import type { CategoryScopeRebuildOutcome } from './category-scope.types';

/**
 * Full rebuild of one `object_categories_related` scope: aggregate, then replace its rows in one
 * transaction. The one implementation behind the chain-indexer queue worker and the
 * `categories:rebuild` script. Pass `trx` to run inside the caller's transaction (the script's
 * `--dry-run` rolls it back); otherwise each rebuild opens its own.
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
export class CategoryScopeRebuildService {
  constructor(private readonly repository: CategoryScopeRepository) {}

  async rebuildGlobalScope(
    trx?: Transaction<OdlDatabase>,
  ): Promise<CategoryScopeRebuildOutcome> {
    await this.inTransaction(trx, async (executor) => {
      const rows = await this.repository.aggregateGlobalScope(executor);
      await this.repository.replaceScopeRows(
        'global',
        GLOBAL_CATEGORY_SCOPE_KEY,
        rows,
        executor,
      );
    });
    return 'rebuilt';
  }

  /** All active objects of a category type (the Discover tree). */
  async rebuildTypeScope(
    objectType: string,
    trx?: Transaction<OdlDatabase>,
  ): Promise<CategoryScopeRebuildOutcome> {
    const type = objectType.trim();
    if (!objectTypeSupportsCategories(type)) {
      return 'not_category_type';
    }
    await this.inTransaction(trx, async (executor) => {
      const rows = await this.repository.aggregateTypeScope(type, executor);
      await this.repository.replaceScopeRows('type', type, rows, executor);
    });
    return 'rebuilt';
  }

  /**
   * One user scope (`account:categoryType`, the Favorites tree): favorites ∪ authored posts,
   * minus deselected post-linked objects, without post-linked objects when the user hides them.
   * A legacy key (no separator, several types, a non-category type) only loses its rows.
   */
  async rebuildUserScope(
    scopeKey: string,
    trx?: Transaction<OdlDatabase>,
  ): Promise<CategoryScopeRebuildOutcome> {
    const key = scopeKey.trim();
    const parsed = parseUserCategoryScopeKey(key);
    if (!parsed) {
      await this.repository.deleteScope('user', key, trx);
      return 'legacy_deleted';
    }
    const { account, objectType } = parsed;
    const [flags, deselectIds] = await Promise.all([
      this.repository.findUserVisibilityFlags(account, trx),
      this.repository.findDeselectedObjectIds(account, trx),
    ]);
    const includePostObjects =
      resolvePostLinkedObjectTypes([objectType], flags).length > 0;

    await this.inTransaction(trx, async (executor) => {
      const rows = await this.repository.aggregateUserScope(
        key,
        { account, objectType, includePostObjects, deselectIds },
        executor,
      );
      await this.repository.replaceScopeRows('user', key, rows, executor);
    });
    return 'rebuilt';
  }

  private async inTransaction(
    trx: Transaction<OdlDatabase> | undefined,
    work: (executor: Transaction<OdlDatabase>) => Promise<void>,
  ): Promise<void> {
    if (trx) {
      await work(trx);
      return;
    }
    await this.repository.runInTransaction(work);
  }
}
