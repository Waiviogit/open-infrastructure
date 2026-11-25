/**
 * Rebuild the per-object search documents (`object_search_docs`) through their sync queue, with the
 * same contract as the chain-indexer worker: enqueue, then drain (`claimBatch` →
 * `ObjectSearchRebuildService.rebuild` → `finishClaimed`; a failing id is released and retried
 * later). The script and the live worker are both claimers (`SKIP LOCKED`), so neither overwrites a
 * newer document with an older one.
 *
 * Usage (repo root, or the migrator image: `docker compose run --rm migrator pnpm search-docs:rebuild …`):
 *   pnpm search-docs:rebuild --all                    # enqueue every objects_core row, then drain
 *   pnpm search-docs:rebuild --repair                 # active objects without a document + documents of non-active objects
 *   pnpm search-docs:rebuild --queued                 # drain what is already queued
 *   pnpm search-docs:rebuild --object-id a --object-id b
 *   pnpm search-docs:rebuild --check                  # read-only; exit 1 when anything is off
 * Options:
 *   --dry-run               build documents for the selected ids and print counts; no enqueue, no write
 *   --batch-size N          ids per batch (default 1000, max 5000)
 *   --force                 rewrite documents even when their content hash is unchanged
 *   --default-governance    run without GOVERNANCE_OBJECT_ID (empty governance snapshot)
 *
 * Governance must be explicit: GOVERNANCE_OBJECT_ID names a `governance` object (the one the
 * chain-indexer uses), or `--default-governance` is passed; otherwise the script stops before doing
 * anything, since other governance picks other winners than the worker.
 *
 * Exit code 1 when any id failed (or, with --check, when any count is non-zero). Requires
 * POSTGRES_HOST, POSTGRES_USER, POSTGRES_DATABASE (optionally POSTGRES_PASSWORD, POSTGRES_PORT).
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
import { OBJECT_TYPES } from '@opden-data-layer/core';
import {
  ObjectSearchQueueRepository,
  ObjectSearchRebuildService,
  ObjectSearchSourceRepository,
  PostgresObjectSearchSink,
  type ObjectSearchQueueTask,
  type ObjectSearchRebuildResult,
} from '@opden-data-layer/object-search';
import {
  DEFAULT_GOVERNANCE_SNAPSHOT,
  type GovernanceSnapshot,
} from '@opden-data-layer/objects-domain';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

import { resolveConnectionString } from '../libs/migrations/src/connection';
import { resolvePlatformGovernance } from './lib/resolve-platform-governance';

const DEFAULT_BATCH_SIZE = 1_000;
const MAX_BATCH_SIZE = 5_000;
/** Same retry window as the chain-indexer worker (`OBJECT_SEARCH_DOCS_RETRY_AFTER_SEC`). */
const RETRY_AFTER_SEC = 60;
/** Progress line every this many batches. */
const PROGRESS_EVERY_BATCHES = 20;
/** Failed ids listed in the summary before `…`. */
const LIST_LIMIT = 30;
const MS_PER_SECOND = 1_000;

type Mode = 'all' | 'repair' | 'queued' | 'object-id' | 'check';

interface CliOptions {
  mode: Mode;
  objectIds: string[];
  dryRun: boolean;
  batchSize: number;
  force: boolean;
  defaultGovernance: boolean;
}

interface DrainTotals {
  batches: number;
  claimed: number;
  upserted: number;
  deleted: number;
  missing: number;
  failed: Map<string, string>;
}

type Db = Kysely<OdlDatabase>;

const USAGE = [
  'Usage: pnpm search-docs:rebuild <mode> [options]',
  'Modes (exactly one): --all | --repair | --queued | --object-id <id> (repeatable) | --check',
  `Options: --dry-run, --batch-size N (default ${DEFAULT_BATCH_SIZE}, max ${MAX_BATCH_SIZE}), --force, --default-governance`,
].join('\n');

function print(line = ''): void {
  console.log(line);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): CliOptions {
  const modes = new Set<Mode>();
  const objectIds: string[] = [];
  let dryRun = false;
  let force = false;
  let defaultGovernance = false;
  let batchSize = DEFAULT_BATCH_SIZE;

  const valueOf = (i: number, flag: string): string => {
    const next = argv[i + 1]?.trim();
    if (!next || next.startsWith('--')) {
      fail(`${flag} requires a value.\n${USAGE}`);
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') modes.add('all');
    else if (arg === '--repair') modes.add('repair');
    else if (arg === '--queued') modes.add('queued');
    else if (arg === '--check') modes.add('check');
    else if (arg === '--object-id') {
      modes.add('object-id');
      objectIds.push(valueOf(i++, arg));
    } else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--force') force = true;
    else if (arg === '--default-governance') defaultGovernance = true;
    else if (arg === '--batch-size') {
      const n = Number(valueOf(i++, arg));
      if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH_SIZE) {
        fail(`--batch-size must be an integer 1..${MAX_BATCH_SIZE}.`);
      }
      batchSize = n;
    } else {
      fail(`Unknown argument: ${arg}\n${USAGE}`);
    }
  }

  if (modes.size !== 1) {
    fail(`Exactly one mode is required.\n${USAGE}`);
  }
  const [mode] = [...modes] as [Mode];
  if (mode === 'check' && (dryRun || force)) {
    fail('--check is read-only; --dry-run and --force do not apply.');
  }
  return {
    mode,
    objectIds: [...new Set(objectIds)],
    dryRun,
    batchSize,
    force,
    defaultGovernance,
  };
}

function nowUnixSec(): number {
  return Math.floor(Date.now() / MS_PER_SECOND);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The platform governance the worker uses. `resolvePlatformGovernance` returns the empty snapshot
 * for a missing or non-governance object, so both cases are rejected here first.
 */
async function resolveExplicitGovernance(
  db: Db,
  defaultGovernance: boolean,
): Promise<GovernanceSnapshot> {
  const objectId = (process.env['GOVERNANCE_OBJECT_ID'] ?? '').trim();
  if (objectId.length === 0) {
    if (!defaultGovernance) {
      fail(
        'GOVERNANCE_OBJECT_ID is empty. Set it to the governance object the chain-indexer uses, ' +
          'or pass --default-governance to build with the empty governance snapshot.',
      );
    }
    print('Governance: default (empty snapshot, --default-governance)');
    return DEFAULT_GOVERNANCE_SNAPSHOT;
  }
  if (defaultGovernance) {
    fail(
      `GOVERNANCE_OBJECT_ID is set ('${objectId}'); --default-governance would ignore it. Pass one or the other.`,
    );
  }

  const core = await db
    .selectFrom('objects_core')
    .select('object_type')
    .where('object_id', '=', objectId)
    .executeTakeFirst();
  if (!core) {
    fail(`GOVERNANCE_OBJECT_ID '${objectId}' does not exist in objects_core.`);
  }
  if (core.object_type !== OBJECT_TYPES.GOVERNANCE) {
    fail(
      `GOVERNANCE_OBJECT_ID '${objectId}' is of type '${core.object_type}', not '${OBJECT_TYPES.GOVERNANCE}'.`,
    );
  }

  const snapshot = await resolvePlatformGovernance(db, objectId);
  print(`Governance: ${objectId}`);
  return snapshot;
}

function printGovernanceSummary(snapshot: GovernanceSnapshot): void {
  const inherits =
    snapshot.inherits_from.length > 0
      ? snapshot.inherits_from
          .map((e) => `${e.object_id} [${e.scope.join(', ')}]`)
          .join('; ')
      : '-';
  print(
    `  admins ${snapshot.admins.length}, trusted ${snapshot.trusted.length}, ` +
      `moderators ${snapshot.moderators.length}, authorities ${snapshot.authorities.length}, ` +
      `banned ${snapshot.banned.length}, muted ${snapshot.muted.length}`,
  );
  print(`  object_control: ${snapshot.object_control ?? '-'}`);
  print(`  inherits_from: ${inherits}`);
}

/** One page of ids for a read-only dry run, in `object_id` order after `after`. */
type IdPager = (after: string | null, limit: number) => Promise<string[]>;

function allObjectsPager(db: Db): IdPager {
  return async (after, limit) => {
    let query = db.selectFrom('objects_core').select('object_id');
    if (after !== null) {
      query = query.where('object_id', '>', after);
    }
    const rows = await query.orderBy('object_id').limit(limit).execute();
    return rows.map((r) => r.object_id);
  };
}

/** The selection of `ObjectSearchQueueRepository.enqueueRepair`, read-only. */
function repairPager(queue: ObjectSearchQueueRepository): IdPager {
  return (after, limit) => queue.listRepairIds(after, limit);
}

function queuedPager(db: Db): IdPager {
  return async (after, limit) => {
    let query = db
      .selectFrom('object_search_docs_sync_queue')
      .select('object_id');
    if (after !== null) {
      query = query.where('object_id', '>', after);
    }
    const rows = await query.orderBy('object_id').limit(limit).execute();
    return rows.map((r) => r.object_id);
  };
}

function listPager(ids: readonly string[]): IdPager {
  const sorted = [...ids].sort();
  return async (after, limit) =>
    sorted.filter((id) => after === null || id > after).slice(0, limit);
}

function pagerFor(db: Db, queue: ObjectSearchQueueRepository, opts: CliOptions): IdPager {
  switch (opts.mode) {
    case 'all':
      return allObjectsPager(db);
    case 'repair':
      return repairPager(queue);
    case 'queued':
      return queuedPager(db);
    case 'object-id':
      return listPager(opts.objectIds);
    case 'check':
      throw new Error('--check selects no ids');
  }
}

/** Builds documents page by page without touching the queue or any sink. */
async function dryRun(
  service: ObjectSearchRebuildService,
  governance: GovernanceSnapshot,
  pager: IdPager,
  batchSize: number,
): Promise<number> {
  const started = Date.now();
  const totals = {
    batches: 0,
    selected: 0,
    loaded: 0,
    built: 0,
    deleted: 0,
    missing: 0,
  };
  let failedBatches = 0;
  let after: string | null = null;

  for (;;) {
    const ids = await pager(after, batchSize);
    if (ids.length === 0) {
      break;
    }
    after = ids[ids.length - 1] ?? null;
    totals.batches += 1;
    totals.selected += ids.length;
    try {
      const result = await service.rebuild(ids, governance, { dryRun: true });
      totals.loaded += result.loaded;
      totals.built += result.upserted;
      totals.deleted += result.deleted;
      totals.missing += result.missing;
    } catch (error) {
      failedBatches += 1;
      console.error(`batch after '${ids[0]}' failed: ${errorMessage(error)}`);
    }
    if (totals.batches % PROGRESS_EVERY_BATCHES === 0) {
      print(
        `  … ${totals.batches} batches, ${totals.selected} ids, ${elapsed(started)}`,
      );
    }
  }

  print(
    `\nDone (dry run, nothing enqueued or written) in ${elapsed(started)}: ` +
      `${totals.selected} selected, ${totals.loaded} loaded, ${totals.built} documents built, ` +
      `${totals.deleted} would be deleted (not active / dropped), ${totals.missing} missing, ` +
      `${failedBatches} failed batch(es).`,
  );
  return failedBatches > 0 ? 1 : 0;
}

/** Rebuilds a claimed batch; on a batch error falls back to one id at a time, like the worker. */
async function processBatch(
  queue: ObjectSearchQueueRepository,
  service: ObjectSearchRebuildService,
  governance: GovernanceSnapshot,
  tasks: readonly ObjectSearchQueueTask[],
  force: boolean,
  totals: DrainTotals,
): Promise<void> {
  const add = (result: ObjectSearchRebuildResult): void => {
    totals.upserted += result.upserted;
    totals.deleted += result.deleted;
    totals.missing += result.missing;
  };
  try {
    add(
      await service.rebuild(
        tasks.map((t) => t.object_id),
        governance,
        { force },
      ),
    );
    await queue.finishClaimed(tasks);
    return;
  } catch (error) {
    console.error(
      `batch of ${tasks.length} failed (${errorMessage(error)}); retrying one by one`,
    );
  }

  const done: ObjectSearchQueueTask[] = [];
  const failedIds: string[] = [];
  for (const task of tasks) {
    try {
      add(await service.rebuild([task.object_id], governance, { force }));
      done.push(task);
    } catch (error) {
      failedIds.push(task.object_id);
      totals.failed.set(task.object_id, errorMessage(error));
    }
  }
  await queue.finishClaimed(done);
  await queue.releaseClaimed(failedIds);
}

/**
 * Claims and rebuilds until nothing is claimable (failed ids wait out the retry window, so the loop
 * ends). With `untilIds`, stops once those ids were processed or a batch no longer brings any.
 */
async function drain(
  queue: ObjectSearchQueueRepository,
  service: ObjectSearchRebuildService,
  governance: GovernanceSnapshot,
  opts: CliOptions,
  untilIds: Set<string> | null,
): Promise<DrainTotals> {
  const started = Date.now();
  const totals: DrainTotals = {
    batches: 0,
    claimed: 0,
    upserted: 0,
    deleted: 0,
    missing: 0,
    failed: new Map(),
  };

  for (;;) {
    const tasks = await queue.claimBatch(opts.batchSize, RETRY_AFTER_SEC);
    if (tasks.length === 0) {
      break;
    }
    totals.batches += 1;
    totals.claimed += tasks.length;
    await processBatch(queue, service, governance, tasks, opts.force, totals);

    if (totals.batches % PROGRESS_EVERY_BATCHES === 0) {
      print(
        `  … ${totals.batches} batches: claimed ${totals.claimed}, upserted ${totals.upserted}, ` +
          `deleted ${totals.deleted}, failed ${totals.failed.size}, ${elapsed(started)}`,
      );
    }

    if (untilIds) {
      const before = untilIds.size;
      for (const task of tasks) {
        untilIds.delete(task.object_id);
      }
      if (untilIds.size === 0 || untilIds.size === before) {
        break;
      }
    }
  }
  return totals;
}

async function enqueueForMode(
  queue: ObjectSearchQueueRepository,
  opts: CliOptions,
): Promise<void> {
  switch (opts.mode) {
    case 'all':
      print(`Enqueued ${await queue.enqueueAll()} object(s) (bulk rows).`);
      return;
    case 'repair':
      print(
        `Enqueued ${await queue.enqueueRepair()} object(s) to repair (bulk rows).`,
      );
      return;
    case 'object-id':
      await queue.enqueueMany(opts.objectIds, nowUnixSec());
      print(`Enqueued ${opts.objectIds.length} object id(s).`);
      return;
    case 'queued':
    case 'check':
      return;
  }
}

async function runDrain(
  queue: ObjectSearchQueueRepository,
  service: ObjectSearchRebuildService,
  governance: GovernanceSnapshot,
  opts: CliOptions,
): Promise<number> {
  const started = Date.now();
  await enqueueForMode(queue, opts);
  print(
    `Queue: ${await queue.countPending()} row(s) pending. Draining, batch size ${opts.batchSize}…`,
  );

  const untilIds = opts.mode === 'object-id' ? new Set(opts.objectIds) : null;
  const totals = await drain(queue, service, governance, opts, untilIds);
  const stillQueued = await queue.countPending();

  print(
    `\nDone in ${elapsed(started)}: ${totals.batches} batch(es), claimed ${totals.claimed}, ` +
      `upserted ${totals.upserted}, deleted ${totals.deleted}, missing ${totals.missing}, ` +
      `failed ${totals.failed.size}, still queued ${stillQueued}.`,
  );
  if (untilIds && untilIds.size > 0) {
    print(
      `Not claimed by this run (held by another claimer or queued behind other rows; the worker ` +
        `processes them): ${[...untilIds].join(', ')}`,
    );
  }
  if (totals.failed.size > 0) {
    print(`Failed ids (kept queued, retried after ${RETRY_AFTER_SEC} s):`);
    for (const [id, message] of [...totals.failed].slice(0, LIST_LIMIT)) {
      print(`  ${id}: ${message}`);
    }
    if (totals.failed.size > LIST_LIMIT) {
      print(`  … +${totals.failed.size - LIST_LIMIT}`);
    }
    return 1;
  }
  return 0;
}

async function runCheck(queue: ObjectSearchQueueRepository): Promise<number> {
  const queued = await queue.countPending();
  const { activeWithoutDocument: activeWithoutDoc, documentsOfNonActive: docsOfNonActive } =
    await queue.countRepairCandidates();

  print(`queue length:                       ${queued}`);
  print(`active objects without a document:  ${activeWithoutDoc}`);
  print(`documents of non-active objects:    ${docsOfNonActive}`);
  const ok = queued === 0 && activeWithoutDoc === 0 && docsOfNonActive === 0;
  print(ok ? 'OK' : 'NOT OK: run --queued (or --repair) and check again.');
  return ok ? 0 : 1;
}

function elapsed(startedMs: number): string {
  return `${((Date.now() - startedMs) / MS_PER_SECOND).toFixed(1)} s`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: resolveConnectionString() });
  const db: Db = new Kysely<OdlDatabase>({
    dialect: new PostgresDialect({ pool }),
  });
  const queue = new ObjectSearchQueueRepository(db);

  try {
    if (opts.mode === 'check') {
      process.exitCode = await runCheck(queue);
      return;
    }

    const governance = await resolveExplicitGovernance(
      db,
      opts.defaultGovernance,
    );
    printGovernanceSummary(governance);
    print(
      `Mode: --${opts.mode}${opts.dryRun ? ' (dry run)' : ''}${opts.force ? ' --force' : ''}, ` +
        `batch size ${opts.batchSize}\n`,
    );

    const service = new ObjectSearchRebuildService(
      new ObjectSearchSourceRepository(db),
      [new PostgresObjectSearchSink(db)],
    );
    process.exitCode = opts.dryRun
      ? await dryRun(service, governance, pagerFor(db, queue, opts), opts.batchSize)
      : await runDrain(queue, service, governance, opts);
  } finally {
    await db.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
