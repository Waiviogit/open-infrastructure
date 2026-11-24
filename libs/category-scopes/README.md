# @opden-data-layer/category-scopes

Category trees (`object_categories_related`): the rebuild of one scope, the navigation rules clients see, and a before / after report.

| Module | Contents | Used by |
|--------|----------|---------|
| `navigation/` | Pure: display rules (≥ 3 units, ≤ 60% of the level), candidates, root dominance and cap (`selectRootCategories`), near-duplicates | query-api `CategoryNavigationService`, `report/` |
| `rebuild/` | `CategoryScopeRepository` (aggregation SQL, replace under an advisory lock, reads), `CategoryScopeRebuildService` (global / type / user scope, own or caller's transaction) | chain-indexer `ObjectCategoriesRelatedWorker`, `scripts/rebuild-category-scopes.ts` |
| `report/` | `snapshotCategoryScope` (stored counts + visible root), `diffCategoryScopes` | `scripts/rebuild-category-scopes.ts` |

Docs: [object categories (chain-indexer)](../../docs/apps/chain-indexer/spec/object-categories.md), [category navigation (query-api)](../../docs/apps/query-api/spec/categories.md), [`pnpm categories:rebuild`](../../docs/operations/category-scopes-rebuild.md).

Tests: `pnpm nx test category-scopes` (unit). The scope SQL runs against Postgres in chain-indexer's `category-scope-rebuild.db.spec.ts` (needs `POSTGRES_TEST_URL`, see [test Postgres harness](../../docs/standards/test-postgres-harness.md)); a lib cannot import the untagged `migrations` project.
