import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Account that actually paid when an OBL payment is made on behalf of the debtor.
 * `payer` stays the debtor, so netting keeps working on the debtor↔receiver pair.
 * @see docs/spec/obl/payments.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE obl_payments
    ADD COLUMN paid_by TEXT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_obl_payments_paid_by
    ON obl_payments (paid_by)
    WHERE paid_by IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_obl_payments_paid_by`.execute(db);
  await sql`
    ALTER TABLE obl_payments
    DROP COLUMN IF EXISTS paid_by
  `.execute(db);
}
