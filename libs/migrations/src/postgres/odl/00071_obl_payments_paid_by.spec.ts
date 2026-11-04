import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { createTestDb, withRollback } from '@opden-data-layer/test-postgres';
import { down, up } from './00071_obl_payments_paid_by';

async function paidByColumn(
  db: Kysely<unknown>,
): Promise<{ is_nullable: string } | undefined> {
  const result = await sql<{ is_nullable: string }>`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_name = 'obl_payments' AND column_name = 'paid_by'
  `.execute(db);
  return result.rows[0];
}

describe('00071_obl_payments_paid_by', () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.destroy();
  });

  it('adds a nullable paid_by column that keeps existing rows null and drops it on down', async () => {
    await withRollback(db, async (trx) => {
      const raw = trx as unknown as Kysely<unknown>;
      await down(raw);
      expect(await paidByColumn(raw)).toBeUndefined();

      await trx
        .insertInto('obl_payments')
        .values({
          payment_id: 'pay-legacy',
          payer: 'alice',
          receiver: 'bob',
          amount_usd: '10',
          declared_amount_usd: '10',
          method: 'offchain',
          token_symbol: null,
          token_amount: null,
          rate_usd: null,
          state: 'pending',
          created_event_seq: BigInt(1),
          transaction_id: 'tx-legacy',
        } as never)
        .execute();

      await up(raw);
      expect(await paidByColumn(raw)).toEqual({ is_nullable: 'YES' });

      const legacy = await trx
        .selectFrom('obl_payments')
        .select(['paid_by'])
        .where('payment_id', '=', 'pay-legacy')
        .executeTakeFirstOrThrow();
      expect(legacy.paid_by).toBeNull();

      await trx
        .insertInto('obl_payments')
        .values({
          payment_id: 'pay-on-behalf',
          payer: 'alice',
          receiver: 'bob',
          paid_by: 'carol',
          amount_usd: '5',
          declared_amount_usd: '5',
          method: 'offchain',
          token_symbol: null,
          token_amount: null,
          rate_usd: null,
          state: 'pending',
          created_event_seq: BigInt(2),
          transaction_id: 'tx-on-behalf',
        })
        .execute();
      const onBehalf = await trx
        .selectFrom('obl_payments')
        .select(['payer', 'paid_by'])
        .where('payment_id', '=', 'pay-on-behalf')
        .executeTakeFirstOrThrow();
      expect(onBehalf).toEqual({ payer: 'alice', paid_by: 'carol' });
    });
  });
});
