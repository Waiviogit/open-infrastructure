# @opden-data-layer/object-search

Object search read model (`object_search_docs`): one search document per active object, the text normalization shared by indexing and queries, and the queue that keeps documents current.

| Module | Contents | Used by |
|--------|----------|---------|
| `text/` | `normalizeSearchText`, `buildPrefixTsQuery` (query for `to_tsquery('simple', …)`) | query-api search and Discover filters, `sink/` |
| `document/` | `ObjectSearchDocument` (engine-neutral), `buildObjectSearchDocument` (resolver winners only), `computeContentHash`, `SEARCH_DOC_UPDATE_TYPES` | `rebuild/`, chain-indexer handlers |
| `sink/` | `ObjectSearchSink` + `OBJECT_SEARCH_SINKS` token, `PostgresObjectSearchSink` | `rebuild/` |
| `source/` | `ObjectSearchSourceRepository` (trimmed batch loader; throws on error) | `rebuild/` |
| `queue/` | `ObjectSearchQueueRepository` (`object_search_docs_sync_queue`: live rows before bulk rows) | chain-indexer worker and handlers, scheduler, `scripts/rebuild-object-search-docs.ts` |
| `rebuild/` | `ObjectSearchRebuildService` (load → build → every sink) | chain-indexer `ObjectSearchDocsWorker`, `scripts/rebuild-object-search-docs.ts` |

Plain classes that take `Kysely<OdlDatabase>`; apps provide them through their own Nest modules. Server-only (uses `node:crypto`); not for `apps/web`.

Docs: [ADR](../../docs/architecture/adr/search-read-model.md), [object search documents (chain-indexer)](../../docs/apps/chain-indexer/spec/object-search-docs.md), [search API](../../docs/apps/query-api/spec/search.md), [`pnpm search-docs:rebuild`](../../docs/operations/object-search-docs-rebuild.md).

Tests: `pnpm nx test object-search` (unit). The SQL of the sink and the queue runs against Postgres in query-api's `object-search-docs.db.spec.ts` (needs `POSTGRES_TEST_URL`, see [test Postgres harness](../../docs/standards/test-postgres-harness.md)); a lib cannot import the untagged `migrations` project.
