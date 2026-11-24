/**
 * Rebuild category scopes (`object_categories_related`) directly, without the chain-indexer queue,
 * and report what clients see change: which root categories appeared or disappeared, and which
 * stored categories were added, removed or recounted. Uses the same rebuild as the chain-indexer
 * worker (`@opden-data-layer/category-scopes`).
 *
 * Usage (repo root, or the migrator image: `docker compose run --rm migrator pnpm categories:rebuild …`):
 *   pnpm categories:rebuild                         # every type scope + every user scope
 *   pnpm categories:rebuild --types                 # Discover trees only (every category type)
 *   pnpm categories:rebuild --type product --type book
 *   pnpm categories:rebuild --users                 # Favorites trees only (every account:type)
 *   pnpm categories:rebuild --user alice            # every category type of one account
 *   pnpm categories:rebuild --global                # adds the global scope
 *   pnpm categories:rebuild --dry-run               # rebuild + report, then roll back
 *   pnpm categories:rebuild --verbose               # list every stored change too
 *   pnpm categories:rebuild --concurrency 8         # parallel user scopes (default 4)
 *
 * Exit code 1 when any scope failed. Requires POSTGRES_HOST, POSTGRES_USER, POSTGRES_DATABASE
 * (optionally POSTGRES_PASSWORD, POSTGRES_PORT).
 * @see docs/apps/chain-indexer/spec/object-categories.md
 */
import {
  CATEGORY_MAX_SHARE,
  CATEGORY_MIN_OBJECTS,
  CategoryScopeRebuildService,
  CategoryScopeRepository,
  diffCategoryScopes,
  GLOBAL_CATEGORY_SCOPE_KEY,
  hasCategoryScopeChanges,
  snapshotCategoryScope,
  type CategoryCount,
  type CategoryScopeDiff,
  type CategoryScopeRebuildOutcome,
  type CategoryScopeSnapshot,
} from '@opden-data-layer/category-scopes';
import {
  CATEGORY_OBJECT_TYPES,
  objectTypeSupportsCategories,
} from '@opden-data-layer/core';
import type {
  ObjectCategoriesRelatedScopeType,
  OdlDatabase,
} from '@opden-data-layer/odl-db-types';
import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';

import { resolveConnectionString } from '../libs/migrations/src/connection';

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 16;
/** Progress line every this many user scopes. */
const USER_PROGRESS_EVERY = 500;
/** Names listed per line kind before `…`. */
const LIST_LIMIT = 30;

interface CliOptions {
  types: string[];
  accounts: string[];
  allTypes: boolean;
  allUsers: boolean;
  global: boolean;
  dryRun: boolean;
  verbose: boolean;
  concurrency: number;
}

type ScopeResult = {
  scopeType: ObjectCategoriesRelatedScopeType;
  scopeKey: string;
  outcome: CategoryScopeRebuildOutcome | 'failed';
  error?: string;
  ms: number;
  before?: CategoryScopeSnapshot;
  after?: CategoryScopeSnapshot;
  diff?: CategoryScopeDiff;
};

function print(line = ''): void {
  console.log(line);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    types: [],
    accounts: [],
    allTypes: false,
    allUsers: false,
    global: false,
    dryRun: false,
    verbose: false,
    concurrency: DEFAULT_CONCURRENCY,
  };
  const valueOf = (i: number, flag: string): string => {
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      fail(`${flag} requires a value.`);
    }
    return next.trim();
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--types') opts.allTypes = true;
    else if (arg === '--users') opts.allUsers = true;
    else if (arg === '--global') opts.global = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--type') opts.types.push(valueOf(i++, arg));
    else if (arg === '--user') opts.accounts.push(valueOf(i++, arg));
    else if (arg === '--concurrency') {
      const n = Number(valueOf(i++, arg));
      if (!Number.isInteger(n) || n < 1 || n > MAX_CONCURRENCY) {
        fail(`--concurrency must be an integer 1..${MAX_CONCURRENCY}.`);
      }
      opts.concurrency = n;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  for (const type of opts.types) {
    if (!objectTypeSupportsCategories(type)) {
      fail(
        `'${type}' is not a category type (${CATEGORY_OBJECT_TYPES.join(', ')}).`,
      );
    }
  }
  const nothingPicked =
    !opts.allTypes &&
    !opts.allUsers &&
    !opts.global &&
    opts.types.length === 0 &&
    opts.accounts.length === 0;
  if (nothingPicked) {
    opts.allTypes = true;
    opts.allUsers = true;
  }
  return opts;
}

/** Thrown inside a dry-run transaction so Kysely rolls it back; carries the result out. */
class DryRunRollback extends Error {
  constructor(readonly result: ScopeResult) {
    super('dry-run rollback');
  }
}

async function rebuildOne(
  db: Kysely<OdlDatabase>,
  repository: CategoryScopeRepository,
  service: CategoryScopeRebuildService,
  scopeType: ObjectCategoriesRelatedScopeType,
  scopeKey: string,
  dryRun: boolean,
): Promise<ScopeResult> {
  const started = Date.now();
  const run = async (trx: Transaction<OdlDatabase>): Promise<ScopeResult> => {
    const before = snapshotCategoryScope(
      await repository.findScopeRows(scopeType, scopeKey, trx),
    );
    const outcome =
      scopeType === 'global'
        ? await service.rebuildGlobalScope(trx)
        : scopeType === 'type'
          ? await service.rebuildTypeScope(scopeKey, trx)
          : await service.rebuildUserScope(scopeKey, trx);
    const after = snapshotCategoryScope(
      await repository.findScopeRows(scopeType, scopeKey, trx),
    );
    return {
      scopeType,
      scopeKey,
      outcome,
      ms: Date.now() - started,
      before,
      after,
      diff: diffCategoryScopes(before, after),
    };
  };
  try {
    return await db.transaction().execute(async (trx) => {
      const result = await run(trx);
      if (dryRun) {
        throw new DryRunRollback(result);
      }
      return result;
    });
  } catch (e) {
    if (e instanceof DryRunRollback) {
      return e.result;
    }
    return {
      scopeType,
      scopeKey,
      outcome: 'failed',
      error: (e as Error).message,
      ms: Date.now() - started,
    };
  }
}

function formatCounts(counts: readonly CategoryCount[]): string {
  const shown = counts.slice(0, LIST_LIMIT).map((c) => `${c.name} ${c.count}`);
  const more =
    counts.length > LIST_LIMIT ? `, … +${counts.length - LIST_LIMIT}` : '';
  return shown.join(', ') + more;
}

function formatTotal(diff: CategoryScopeDiff): string {
  return diff.totalBefore === diff.totalAfter
    ? `${diff.totalAfter ?? '-'}`
    : `${diff.totalBefore ?? '-'} → ${diff.totalAfter ?? '-'}`;
}

function printDiffDetails(diff: CategoryScopeDiff, verbose: boolean): void {
  if (diff.visibleAdded.length > 0)
    print(`    + now visible: ${formatCounts(diff.visibleAdded)}`);
  if (diff.visibleRemoved.length > 0) {
    print(`    - no longer visible: ${formatCounts(diff.visibleRemoved)}`);
  }
  if (!verbose) {
    return;
  }
  if (diff.storedAdded.length > 0)
    print(`    stored added: ${formatCounts(diff.storedAdded)}`);
  if (diff.storedRemoved.length > 0)
    print(`    stored removed: ${formatCounts(diff.storedRemoved)}`);
  if (diff.countChanged.length > 0) {
    const changes = diff.countChanged
      .slice(0, LIST_LIMIT)
      .map((c) => `${c.name} ${c.before}→${c.after}`)
      .join(', ');
    print(
      `    recounted: ${changes}${diff.countChanged.length > LIST_LIMIT ? ', …' : ''}`,
    );
  }
}

function printFailure(result: ScopeResult): void {
  print(
    `${result.scopeType} ${result.scopeKey}: FAILED after ${result.ms} ms — ${result.error}`,
  );
}

/** Type (and global) scopes: always the full picture — they are few and drive Discover. */
function printTypeResult(result: ScopeResult, verbose: boolean): void {
  if (result.outcome === 'failed' || !result.diff || !result.after) {
    printFailure(result);
    return;
  }
  const { diff, after } = result;
  print(
    `${result.scopeType} ${result.scopeKey}: total ${formatTotal(diff)} groups, ` +
      `${after.stored.length} stored categories ` +
      `(+${diff.storedAdded.length} / -${diff.storedRemoved.length} / ${diff.countChanged.length} recounted), ` +
      `${result.ms} ms`,
  );
  if (result.scopeType === 'type') {
    printTypeRoot(after, verbose);
  }
  printDiffDetails(diff, verbose);
}

function printTypeRoot(after: CategoryScopeSnapshot, verbose: boolean): void {
  if (after.stored.length === 0) {
    print('    root: EMPTY — no active object of this type has a category');
    return;
  }
  const other = after.showOther ? ' + Other' : '';
  print(
    after.visibleRoot.length > 0
      ? `    root (${after.visibleRoot.length}${other}): ${formatCounts(after.visibleRoot)}`
      : `    root: EMPTY — none of ${after.stored.length} categories passes the display rules`,
  );
  if (verbose) {
    const hidden = hiddenRootReasons(after);
    if (hidden.length > 0) {
      print(
        `    hidden at root: ${hidden.slice(0, LIST_LIMIT).join(', ')}${hidden.length > LIST_LIMIT ? ', …' : ''}`,
      );
    }
  }
}

/** Why each stored category is not on the root: the display rules, else dominance or the cap. */
function hiddenRootReasons(snapshot: CategoryScopeSnapshot): string[] {
  const visible = new Set(snapshot.visibleRoot.map((c) => c.name));
  const total = snapshot.total ?? 0;
  return snapshot.stored
    .filter((c) => !visible.has(c.name))
    .map((c) => {
      if (c.count < CATEGORY_MIN_OBJECTS) {
        return `${c.name} ${c.count} (< ${CATEGORY_MIN_OBJECTS})`;
      }
      const share = total > 0 ? c.count / total : 0;
      if (share > CATEGORY_MAX_SHARE) {
        return `${c.name} ${c.count} (${Math.round(share * 100)}% > ${Math.round(CATEGORY_MAX_SHARE * 100)}%)`;
      }
      return `${c.name} ${c.count} (under a larger root category, or past the cap)`;
    });
}

/** User scopes: only the ones whose root changed (or every change with --verbose). */
function printUserResult(result: ScopeResult, verbose: boolean): void {
  if (result.outcome === 'failed' || !result.diff) {
    printFailure(result);
    return;
  }
  if (result.outcome === 'legacy_deleted') {
    print(`user ${result.scopeKey}: legacy key, rows deleted`);
    return;
  }
  const rootChanged =
    result.diff.visibleAdded.length > 0 ||
    result.diff.visibleRemoved.length > 0;
  if (!rootChanged && !(verbose && hasCategoryScopeChanges(result.diff))) {
    return;
  }
  print(`user ${result.scopeKey}: total ${formatTotal(result.diff)}`);
  printDiffDetails(result.diff, verbose);
}

async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++] as T;
        await work(item);
      }
    },
  );
  await Promise.all(lanes);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({
    connectionString: resolveConnectionString(),
    max: opts.concurrency + 1,
  });
  const db = new Kysely<OdlDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
  const repository = new CategoryScopeRepository(db);
  const service = new CategoryScopeRebuildService(repository);
  const rebuild = (
    scopeType: ObjectCategoriesRelatedScopeType,
    scopeKey: string,
  ) => rebuildOne(db, repository, service, scopeType, scopeKey, opts.dryRun);
  const results: ScopeResult[] = [];
  const started = Date.now();

  try {
    print(opts.dryRun ? 'DRY RUN: every rebuild is rolled back.\n' : '');

    if (opts.global) {
      const result = await rebuild('global', GLOBAL_CATEGORY_SCOPE_KEY);
      results.push(result);
      printTypeResult(result, opts.verbose);
    }

    const types = opts.allTypes
      ? [...CATEGORY_OBJECT_TYPES]
      : [...new Set(opts.types)];
    for (const type of types) {
      const result = await rebuild('type', type);
      results.push(result);
      printTypeResult(result, opts.verbose);
    }

    const userKeys = opts.allUsers
      ? await repository.listUserScopeKeys(null)
      : (
          await Promise.all(
            opts.accounts.map((a) => repository.listUserScopeKeys(a)),
          )
        ).flat();
    if (userKeys.length > 0) {
      print(
        `\n${userKeys.length} user scope(s), concurrency ${opts.concurrency}:`,
      );
    } else if (opts.allUsers || opts.accounts.length > 0) {
      print('\nNo user scopes found.');
    }
    let done = 0;
    await runPool(userKeys, opts.concurrency, async (key) => {
      const result = await rebuild('user', key);
      results.push(result);
      printUserResult(result, opts.verbose);
      done += 1;
      if (done % USER_PROGRESS_EVERY === 0) {
        print(`  … ${done}/${userKeys.length}`);
      }
    });
  } finally {
    await db.destroy();
  }

  const users = results.filter((r) => r.scopeType === 'user');
  const failed = results.filter((r) => r.outcome === 'failed');
  const usersWithRootChanges = users.filter(
    (r) =>
      r.diff &&
      (r.diff.visibleAdded.length > 0 || r.diff.visibleRemoved.length > 0),
  );
  print(
    `\nDone${opts.dryRun ? ' (dry run, nothing written)' : ''} in ${((Date.now() - started) / 1000).toFixed(1)} s: ` +
      `${results.length - users.length} type/global scope(s), ${users.length} user scope(s) ` +
      `(${usersWithRootChanges.length} with root changes, ` +
      `${users.filter((r) => r.outcome === 'legacy_deleted').length} legacy deleted), ` +
      `${failed.length} failed.`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
