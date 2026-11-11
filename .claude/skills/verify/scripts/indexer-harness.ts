/**
 * Verification harness for chain-indexer: boots the real parser graph (full Nest DI, no block
 * processors) against the disposable test Postgres + a throwaway Redis, then runs a scenario that
 * feeds synthetic Hive / Hive Engine blocks through the production entry points:
 *   - BLOCK_PARSER (HiveMainParser.parseBlock) for Hive custom_json / transfers / votes
 *   - HiveEngineCompositeParser.parseBlock for Hive Engine sidechain blocks
 *
 * Usage: see ../SKILL.md (`node -r ts-node/register -r <tsconfig-paths>/register indexer-harness.ts <scenario.ts> [step]`).
 * Never point POSTGRES_* at the dev database — the harness refuses any database not named `test`.
 */
import 'reflect-metadata';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { NestFactory } from '@nestjs/core';
import type { Kysely } from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';
// Verification tool only (not app code): RedisClientInterface has no XRANGE, so read the stream directly.
import Redis from 'ioredis';
import {
  HIVE_RPC_NODES,
  HiveClientModule,
  HiveEngineClientModule,
  IpfsClientModule,
  RedisClientModule,
} from '@opden-data-layer/clients';
import { BLOCK_PARSER } from '@opden-data-layer/hive-processor';

const REPO = path.resolve(__dirname, '../../../..');
const SRC = path.join(REPO, 'apps/chain-indexer/src');
const chainIndexerConfig = require(`${SRC}/config/chain-indexer.config`).default;
const { DatabaseModule, KYSELY } = require(`${SRC}/database`);
const { RepositoriesModule } = require(`${SRC}/repositories`);
const { HiveParserProvidersModule } = require(`${SRC}/domain/hive-parser/hive-parser-providers.module`);
const { OblParserModule } = require(`${SRC}/domain/obl-parser/obl-parser.module`);
const { NotificationAdapterModule } = require(`${SRC}/domain/notification-adapter/notification-adapter.module`);
const { OblTokenTransferParser } = require(`${SRC}/domain/hive-engine-parser/parsers/obl-token-transfer.parser`);
const { HiveEngineCompositeParser } = require(`${SRC}/domain/hive-engine-parser/hive-engine-composite.parser`);
const { HIVE_ENGINE_SUB_PARSERS } = require(`${SRC}/domain/hive-engine-parser/hive-engine-sub-parser.interface`);

/** Notification stream written by NotificationAdapterModule. */
const NOTIFICATION_STREAM_KEY = 'chain-indexer:notifications:stream';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [chainIndexerConfig] }),
    EventEmitterModule.forRoot(),
    // Workers under the parser tree inject SchedulerRegistry.
    ScheduleModule.forRoot(),
    IpfsClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({ apiUrl: 'http://127.0.0.1:1' }),
      inject: [ConfigService],
    }),
    RedisClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => ({ uri: c.get<string>('redis.uri') as string }),
      inject: [ConfigService],
    }),
    HiveClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => ({ nodes: HIVE_RPC_NODES, ...c.get('hive.client') }),
      inject: [ConfigService],
    }),
    HiveEngineClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (c: ConfigService) => c.get('hiveEngine.client'),
      inject: [ConfigService],
    }),
    DatabaseModule,
    RepositoriesModule,
    HiveParserProvidersModule,
    OblParserModule,
    NotificationAdapterModule,
  ],
  providers: [
    // Add more Hive Engine sub-parsers here when a scenario needs them.
    OblTokenTransferParser,
    {
      provide: HIVE_ENGINE_SUB_PARSERS,
      useFactory: (...parsers: unknown[]) => parsers,
      inject: [OblTokenTransferParser],
    },
    HiveEngineCompositeParser,
  ],
})
class HarnessModule {}

export type CustomJsonOpLike = {
  id: string;
  json: string;
  required_auths: readonly string[];
  required_posting_auths: readonly string[];
};

export type HeTxLike = {
  contract: string;
  action: string;
  sender: string;
  transactionId: string;
  payload: string;
  logs: string;
};

export type Harness = {
  /** Kysely on the test database (any table). */
  db: Kysely<OdlDatabase>;
  /** Any provider from the harness Nest context (e.g. a worker class, to call `runBatch()` synchronously). */
  get<T>(token: unknown): T;
  /** Wraps custom_json ops into one synthetic Hive block (one tx per op) and parses it. */
  hiveBlock(ops: CustomJsonOpLike[]): Promise<number>;
  /** Parses one synthetic Hive Engine block referencing the given Hive block number. */
  heBlock(refHiveBlockNumber: number, txs: HeTxLike[]): Promise<void>;
  /** Builds a successful `tokens/transfer` Hive Engine tx (payload + logs) as the sidechain emits it. */
  heTokenTransfer(input: { sender: string; to: string; symbol: string; quantity: string; memo?: string; txId: string }): HeTxLike;
  /** Decoded events from the notification Redis stream. */
  notifications(): Promise<Array<{ type: string; actor: string | null; payload: unknown }>>;
  log(label: string, rows: unknown[]): void;
};

export type Scenario = Record<string, (h: Harness) => Promise<void>>;

function assertTestDatabase(): void {
  if (process.env.POSTGRES_DATABASE !== 'test') {
    throw new Error('indexer-harness: POSTGRES_DATABASE must be "test" (never the dev database)');
  }
}

async function main(): Promise<void> {
  assertTestDatabase();
  const [scenarioPath, step] = process.argv.slice(2);
  if (!scenarioPath || !step) {
    throw new Error('usage: indexer-harness.ts <scenario.ts> <step>');
  }
  const scenario: Scenario = require(path.resolve(scenarioPath)).default;
  const run = scenario[step];
  if (!run) {
    throw new Error(`scenario has no step "${step}" (steps: ${Object.keys(scenario).join(', ')})`);
  }

  const app = await NestFactory.createApplicationContext(HarnessModule, { logger: ['error', 'warn'] });
  const hive = app.get(BLOCK_PARSER) as { parseBlock(block: unknown): Promise<void> };
  const he = app.get(HiveEngineCompositeParser) as { parseBlock(block: unknown): Promise<void> };
  const redis = new Redis(process.env.REDIS_URI as string, { lazyConnect: true });
  let blockNum = 1_000 + Math.floor(Date.now() / 1000) % 1_000_000;

  const harness: Harness = {
    db: app.get(KYSELY),
    get: <T>(token: unknown): T => app.get(token as never) as T,
    async hiveBlock(ops) {
      blockNum += 1;
      await hive.parseBlock({
        timestamp: new Date().toISOString().slice(0, 19),
        transactions: ops.map((op, i) => ({
          block_num: blockNum,
          transaction_id: `verify-trx-${blockNum}-${i}`,
          operations: [[
            'custom_json',
            { ...op, required_auths: [...op.required_auths], required_posting_auths: [...op.required_posting_auths] },
          ]],
        })),
      });
      return blockNum;
    },
    async heBlock(refHiveBlockNumber, txs) {
      await he.parseBlock({
        blockNumber: refHiveBlockNumber,
        refHiveBlockNumber,
        timestamp: new Date().toISOString().slice(0, 19),
        transactions: txs,
        virtualTransactions: [],
      });
    },
    heTokenTransfer({ sender, to, symbol, quantity, memo, txId }) {
      return {
        contract: 'tokens',
        action: 'transfer',
        sender,
        transactionId: txId,
        payload: JSON.stringify({ to, symbol, quantity, ...(memo !== undefined ? { memo } : {}) }),
        logs: JSON.stringify({
          events: [{ contract: 'tokens', event: 'transfer', data: { from: sender, to, symbol, quantity } }],
        }),
      };
    },
    async notifications() {
      const entries = await redis.xrange(NOTIFICATION_STREAM_KEY, '-', '+');
      return entries.map(([, fields]) => {
        const event = JSON.parse(fields[1]) as { type: string; actor: string | null; payload: unknown };
        return { type: event.type, actor: event.actor, payload: event.payload };
      });
    },
    log(label, rows) {
      console.log(`\n=== ${label} (${rows.length}) ===`);
      for (const row of rows) {
        console.log(JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
      }
    },
  };

  try {
    await run(harness);
  } finally {
    redis.disconnect();
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
